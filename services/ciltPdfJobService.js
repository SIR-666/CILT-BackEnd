const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { PDFDocument } = require("pdf-lib");
const ciltService = require("./ciltService");
const cipService = require("./cipService");
const {
  V2_RENDERER_STYLES,
  dedupeV2Items,
  buildV2SheetFromRecord,
} = require("./ciltPdfRenderers");
const PAGE_SIZE_CONFIG = {
  "A4 portrait": { pageName: "cilt-a4-portrait", cssSize: "A4 portrait" },
  "A4 landscape": { pageName: "cilt-a4-landscape", cssSize: "A4 landscape" },
  "A3 landscape": { pageName: "cilt-a3-landscape", cssSize: "A3 landscape" },
};

const DEFAULT_PAGE_SIZE = "A4 portrait";
const PDF_METADATA_TITLE = "CILTpro PDF - ORIONt";
const JOB_OUTPUT_DIR = path.join(__dirname, "..", "tmp", "cilt-pdf-jobs");
const JOB_TTL_MS = Number(process.env.CILT_PDF_JOB_TTL_MS || 60 * 60 * 1000);
const JOB_CLEANUP_INTERVAL_MS = Number(
  process.env.CILT_PDF_JOB_CLEANUP_INTERVAL_MS || 5 * 60 * 1000
);
const JOB_TIMEOUT_MS = Number(process.env.CILT_PDF_JOB_TIMEOUT_MS || 10 * 60 * 1000);
const MAX_SHEET_COUNT = Number(process.env.CILT_PDF_MAX_SHEETS || 500);
const MAX_SHEETS_PER_CHUNK = Number(process.env.CILT_PDF_SHEETS_PER_CHUNK || 24);
const TARGET_CHUNK_HTML_CHARS = Number(
  process.env.CILT_PDF_TARGET_CHUNK_HTML_CHARS || 3_000_000
);
const MAX_HTML_PAYLOAD_CHARS = Number(
  process.env.CILT_PDF_MAX_HTML_CHARS || 80_000_000
);
const CPU_COUNT = (() => {
  try {
    const cpus = os.cpus();
    return Array.isArray(cpus) && cpus.length > 0 ? cpus.length : 4;
  } catch (error) {
    return 4;
  }
})();
const DEFAULT_ITEM_FETCH_CONCURRENCY = Math.max(2, Math.min(12, CPU_COUNT));
const ITEM_FETCH_CONCURRENCY_OVERRIDE = (() => {
  const raw = String(process.env.CILT_PDF_FETCH_CONCURRENCY || "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(24, Math.floor(parsed)));
})();
const RENDER_CONCURRENCY_OVERRIDE = (() => {
  const raw = String(process.env.CILT_PDF_RENDER_CONCURRENCY || "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(4, Math.floor(parsed)));
})();
const BROWSER_IDLE_TTL_MS = Number(
  process.env.CILT_PDF_BROWSER_IDLE_TTL_MS || 2 * 60 * 1000
);
const BROWSER_CHANNEL = String(process.env.CILT_PDF_BROWSER_CHANNEL || "").trim();
const BROWSER_EXECUTABLE_PATH = String(
  process.env.CILT_PDF_BROWSER_EXECUTABLE_PATH || ""
).trim();
const BROWSER_HEADLESS =
  String(process.env.CILT_PDF_BROWSER_HEADLESS || "true").toLowerCase() !==
  "false";
const BASE_BROWSER_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-extensions",
];
const PRINT_BASE_URL = String(
  process.env.CILT_PDF_PRINT_BASE_URL || "https://10.24.0.81:3011"
).trim();
const PRINT_ROUTE_PATH = `/${String(
  process.env.CILT_PDF_PRINT_ROUTE_PATH || "ciltApproval/print-job"
)
  .trim()
  .replace(/^\/+|\/+$/g, "")}`;
const PRINT_READY_TIMEOUT_MS = Number(
  process.env.CILT_PDF_PRINT_READY_TIMEOUT_MS || 45 * 1000
);
const PRINT_FONT_WAIT_TIMEOUT_MS = Number(
  process.env.CILT_PDF_PRINT_FONT_WAIT_TIMEOUT_MS || 800
);
const ALLOWED_RENDER_MODES = new Set(["inline", "route", "auto"]);
const DEFAULT_RENDER_MODE = (() => {
  const raw = String(process.env.CILT_PDF_RENDER_MODE || "inline")
    .trim()
    .toLowerCase();
  return ALLOWED_RENDER_MODES.has(raw) ? raw : "inline";
})();
const LOCKED_RENDER_MODE = (() => {
  const raw = String(process.env.CILT_PDF_LOCK_RENDER_MODE || "")
    .trim()
    .toLowerCase();
  return ALLOWED_RENDER_MODES.has(raw) ? raw : "";
})();
const SYSTEM_BROWSER_PATH_CANDIDATES = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/opt/google/chrome/chrome",
  "/usr/bin/microsoft-edge",
  "/usr/bin/msedge",
  "/usr/bin/brave-browser",
  "/snap/bin/chromium",
];
const jobs = new Map();
let cleanupTimer = null;
let sharedBrowser = null;
let sharedBrowserPromise = null;
let sharedBrowserCloseTimer = null;
let activeRenderContexts = 0;
let shutdownHookRegistered = false;

const nowIso = () => new Date().toISOString();

const normalizePageSize = (value) =>
  PAGE_SIZE_CONFIG[value] ? value : DEFAULT_PAGE_SIZE;

const sanitizeFileName = (value, fallback = "ciltpro-export.pdf") => {
  const base = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return withExt || fallback;
};

const createJobId = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
};

const createJobToken = () => crypto.randomBytes(24).toString("hex");

const normalizePrintBaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(withProtocol);
    if (!/^https?:$/i.test(parsed.protocol)) return "";
    return `${parsed.protocol}//${parsed.host}`;
  } catch (error) {
    return "";
  }
};

const toPublicJob = (job) => ({
  jobId: job.jobId,
  status: job.status,
  progress: job.progress,
  message: job.message,
  cancelRequested: Boolean(job.cancelRequested),
  fileName: job.fileName,
  requestedBy: job.requestedBy,
  jobSource: job.jobSource || "v2-items",
  renderMode: job.renderMode || DEFAULT_RENDER_MODE,
  totalSheets: job.totalSheets,
  chunkSize: job.chunkSize || null,
  totalChunks: job.totalChunks || null,
  processedChunks: job.processedChunks || 0,
  createdAt: job.createdAt,
  startedAt: job.startedAt || null,
  completedAt: job.completedAt || null,
  metrics: job.metrics || null,
  error: job.error || null,
});

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const stripScriptTags = (input) =>
  String(input || "").replace(/<script[\s\S]*?<\/script>/gi, "");

const sanitizeSheets = (sheets = []) =>
  (Array.isArray(sheets) ? sheets : []).map((sheet) => ({
    ...sheet,
    pageSize: normalizePageSize(sheet?.pageSize),
    html: stripScriptTags(sheet?.html || ""),
  }));

const incrementSummaryCount = (bucket, key) => {
  const normalizedKey = String(key || "").trim() || "UNKNOWN";
  bucket.set(normalizedKey, (bucket.get(normalizedKey) || 0) + 1);
};

const formatSummaryCounts = (bucket) => {
  if (!(bucket instanceof Map) || bucket.size === 0) return "-";
  return Array.from(bucket.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return String(left[0]).localeCompare(String(right[0]));
    })
    .map(([key, count]) => `${key}x${count}`)
    .join("|");
};

const summarizeSheets = (sheets = []) => {
  const normalizedSheets = Array.isArray(sheets) ? sheets : [];
  const pageSizes = new Map();
  const packageTypes = new Map();
  const sourceTypes = new Map();
  const itemIds = [];
  let htmlChars = 0;
  let maxSheetHtmlChars = 0;

  for (const sheet of normalizedSheets) {
    const htmlLength = String(sheet?.html || "").length;
    htmlChars += htmlLength;
    maxSheetHtmlChars = Math.max(maxSheetHtmlChars, htmlLength);
    incrementSummaryCount(pageSizes, normalizePageSize(sheet?.pageSize));
    incrementSummaryCount(packageTypes, sheet?.packageType || "UNKNOWN");
    incrementSummaryCount(
      sourceTypes,
      String(sheet?.sourceType || "CILT").trim().toUpperCase() || "CILT"
    );

    const itemId = Number(sheet?.itemId);
    if (Number.isFinite(itemId) && itemId > 0) {
      itemIds.push(Math.floor(itemId));
    }
  }

  return {
    sheetCount: normalizedSheets.length,
    htmlChars,
    maxSheetHtmlChars,
    pageSizes: formatSummaryCounts(pageSizes),
    packageTypes: formatSummaryCounts(packageTypes),
    sourceTypes: formatSummaryCounts(sourceTypes),
    itemIds: itemIds.length > 0 ? itemIds.join(",") : "-",
  };
};

const normalizeRenderMode = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (ALLOWED_RENDER_MODES.has(raw)) return raw;
  return DEFAULT_RENDER_MODE;
};

const parseNonNegativeInt = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
};

const parsePositiveInt = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const resolveSliceWindow = (total = 0, { offset, limit } = {}) => {
  const normalizedTotal = Math.max(0, Number(total) || 0);
  const safeOffset = Math.min(parseNonNegativeInt(offset, 0), normalizedTotal);
  const safeLimit = Math.min(parsePositiveInt(limit, normalizedTotal || 1), normalizedTotal || 1);
  return {
    offset: safeOffset,
    limit: safeLimit,
    end: Math.min(normalizedTotal, safeOffset + safeLimit),
  };
};

const buildPrintRouteUrl = ({ job, offset = 0, limit = 1 }) => {
  const resolvedPrintBase =
    normalizePrintBaseUrl(job?.printBaseUrl) || normalizePrintBaseUrl(PRINT_BASE_URL);
  if (!resolvedPrintBase) {
    throw new Error("CILT_PDF_PRINT_BASE_URL is not configured.");
  }
  const normalizedBase = resolvedPrintBase.replace(/\/+$/g, "");
  const url = new URL(`${normalizedBase}${PRINT_ROUTE_PATH}`);
  url.searchParams.set("jobId", job.jobId);
  url.searchParams.set("token", job.printToken);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("ts", String(Date.now()));
  return url.toString();
};

const getPlaywrightChromium = () => {
  try {
    // eslint-disable-next-line global-require
    const playwright = require("playwright");
    return playwright?.chromium || null;
  } catch (error) {
    return null;
  }
};

const compactErrorMessage = (error) =>
  String(error?.message || error || "")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeJobErrorMessage = (error) => {
  const message = compactErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("browsertype.launch") ||
    lower.includes("target page, context or browser has been closed") ||
    lower.includes("failed to launch") ||
    lower.includes("executable doesn't exist") ||
    lower.includes("error while loading shared libraries")
  ) {
    return "Browser launch failed on server. Run `npx playwright install --with-deps chromium` and set CILT_PDF_BROWSER_CHANNEL=chromium.";
  }

  if (lower.includes("print route")) {
    const detail = message.replace(/^\[stage:[^\]]+\]\s*/i, "").trim();
    if (detail) {
      return detail.slice(0, 320);
    }
    return "Print route render failed. Check CILT_PDF_PRINT_BASE_URL and FE route /ciltApproval/print-job.";
  }

  if (lower.includes("timeout")) {
    const stageMatch = message.match(/\[stage:([^\]]+)\]/i);
    if (stageMatch?.[1]) {
      return `PDF generation timed out on server at stage '${stageMatch[1]}'.`;
    }
    return "PDF generation timed out on server. Try fewer packages or lower CILT_PDF_SHEETS_PER_CHUNK.";
  }

  return message || "Unknown error";
};

const buildLaunchCandidates = () => {
  const candidates = [];
  const seenLabels = new Set();
  const pushCandidate = (label, options) => {
    if (!label || seenLabels.has(label)) return;
    seenLabels.add(label);
    candidates.push({ label, options });
  };

  if (BROWSER_EXECUTABLE_PATH) {
    pushCandidate(`custom executable (${BROWSER_EXECUTABLE_PATH})`, {
      executablePath: BROWSER_EXECUTABLE_PATH,
      headless: BROWSER_HEADLESS,
      args: BASE_BROWSER_ARGS,
    });
  }

  const systemBrowserCandidates = Array.from(
    new Set(SYSTEM_BROWSER_PATH_CANDIDATES.filter((candidate) => fs.existsSync(candidate)))
  );
  for (const candidatePath of systemBrowserCandidates) {
    pushCandidate(`system executable (${candidatePath})`, {
      executablePath: candidatePath,
      headless: BROWSER_HEADLESS,
      args: BASE_BROWSER_ARGS,
    });
  }

  const channelCandidates = Array.from(
    new Set([BROWSER_CHANNEL, "chromium", "chrome"].filter(Boolean))
  );
  for (const channel of channelCandidates) {
    pushCandidate(`channel (${channel})`, {
      channel,
      headless: BROWSER_HEADLESS,
      args: BASE_BROWSER_ARGS,
    });
  }

  pushCandidate("playwright default", {
    headless: BROWSER_HEADLESS,
    args: BASE_BROWSER_ARGS,
  });

  pushCandidate("playwright default (no custom args)", {
    headless: BROWSER_HEADLESS,
  });

  pushCandidate("playwright fallback single-process", {
    headless: BROWSER_HEADLESS,
    args: [...BASE_BROWSER_ARGS, "--single-process", "--no-zygote"],
  });

  return candidates;
};

const launchBrowserWithFallback = async (chromium) => {
  const candidates = buildLaunchCandidates();
  let lastError = null;

  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line no-console
      console.log(`Launching browser via ${candidate.label}`);
      return await chromium.launch(candidate.options);
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.error(
        `Browser launch failed via ${candidate.label}: ${compactErrorMessage(
          error
        )}`
      );
    }
  }

  throw lastError || new Error("Unable to launch browser.");
};

const clearSharedBrowserCloseTimer = () => {
  if (!sharedBrowserCloseTimer) return;
  clearTimeout(sharedBrowserCloseTimer);
  sharedBrowserCloseTimer = null;
};

const resetSharedBrowserState = () => {
  sharedBrowser = null;
  sharedBrowserPromise = null;
};

const closeSharedBrowser = async () => {
  clearSharedBrowserCloseTimer();
  if (!sharedBrowser) return;
  const browserToClose = sharedBrowser;
  resetSharedBrowserState();
  try {
    await browserToClose.close();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`CILT PDF shared browser close error: ${error.message}`);
  }
};

const scheduleSharedBrowserClose = () => {
  clearSharedBrowserCloseTimer();
  if (BROWSER_IDLE_TTL_MS <= 0) return;
  sharedBrowserCloseTimer = setTimeout(() => {
    if (activeRenderContexts > 0 || !sharedBrowser) return;
    closeSharedBrowser().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`CILT PDF shared browser cleanup error: ${error.message}`);
    });
  }, BROWSER_IDLE_TTL_MS);
  if (typeof sharedBrowserCloseTimer.unref === "function") {
    sharedBrowserCloseTimer.unref();
  }
};

const getSharedBrowser = async (chromium) => {
  clearSharedBrowserCloseTimer();
  if (sharedBrowser && sharedBrowser.isConnected()) {
    return sharedBrowser;
  }
  if (sharedBrowserPromise) {
    return sharedBrowserPromise;
  }

  sharedBrowserPromise = launchBrowserWithFallback(chromium)
    .then((browser) => {
      sharedBrowser = browser;
      sharedBrowserPromise = null;
      if (typeof browser?.on === "function") {
        browser.on("disconnected", () => {
          clearSharedBrowserCloseTimer();
          resetSharedBrowserState();
        });
      }
      return browser;
    })
    .catch((error) => {
      sharedBrowserPromise = null;
      throw error;
    });

  return sharedBrowserPromise;
};

const splitIntoChunks = (
  items = [],
  {
    chunkSize = MAX_SHEETS_PER_CHUNK,
    targetHtmlChars = TARGET_CHUNK_HTML_CHARS,
  } = {}
) => {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedChunkSize = Math.max(1, Number(chunkSize) || MAX_SHEETS_PER_CHUNK);
  const normalizedTargetHtmlChars = Math.max(
    1,
    Number(targetHtmlChars) || TARGET_CHUNK_HTML_CHARS
  );
  const chunks = [];
  let currentSheets = [];
  let currentHtmlChars = 0;
  let currentOffset = 0;

  const pushChunk = () => {
    if (currentSheets.length === 0) return;
    chunks.push({
      offset: currentOffset,
      limit: currentSheets.length,
      sheets: currentSheets,
      htmlChars: currentHtmlChars,
    });
    currentOffset += currentSheets.length;
    currentSheets = [];
    currentHtmlChars = 0;
  };

  normalizedItems.forEach((item) => {
    const itemHtmlChars = String(item?.html || "").length;
    const reachesSheetLimit = currentSheets.length >= normalizedChunkSize;
    const exceedsHtmlTarget =
      currentSheets.length > 0 &&
      currentHtmlChars + itemHtmlChars > normalizedTargetHtmlChars;

    if (reachesSheetLimit || exceedsHtmlTarget) {
      pushChunk();
    }

    currentSheets.push(item);
    currentHtmlChars += itemHtmlChars;
  });

  pushChunk();
  return chunks;
};

const createCancelError = () => {
  const error = new Error("PDF job cancelled.");
  error.code = "PDF_JOB_CANCELLED";
  return error;
};

const ensureJobNotCancelled = (job) => {
  if (!job) throw createCancelError();
  const statusToken = String(job.status || "").toLowerCase();
  if (job.cancelRequested || statusToken === "cancelled") {
    throw createCancelError();
  }
};

const formatMs = (value) => `${Math.max(0, Math.round(Number(value) || 0))}ms`;
const withStageError = (stage, error) => {
  const wrapped = new Error(`[stage:${stage}] ${compactErrorMessage(error)}`);
  wrapped.stage = stage;
  return wrapped;
};

const buildChunkTiming = ({
  mode,
  startedAt,
  gotoDoneAt,
  readyDoneAt,
  fontsDoneAt,
  pdfDoneAt,
}) => ({
  mode,
  gotoMs: gotoDoneAt - startedAt,
  readyMs: readyDoneAt - gotoDoneAt,
  fontsMs: fontsDoneAt - readyDoneAt,
  pdfMs: pdfDoneAt - fontsDoneAt,
  totalMs: pdfDoneAt - startedAt,
});

const renderCurrentPageToPdf = async (page, outputPath, stage = "generate-pdf") => {
  try {
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      timeout: JOB_TIMEOUT_MS,
    });
  } catch (error) {
    throw withStageError(stage, error);
  }
};

const normalizePathname = (urlValue) => {
  try {
    const parsed = new URL(String(urlValue || "").trim());
    return parsed.pathname.replace(/\/+$/g, "");
  } catch (error) {
    return "";
  }
};

const upsertHtmlAttr = (attrs = "", attrName = "", attrValue = "") => {
  const attrRegex = new RegExp(
    `\\s${String(attrName).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=(["'])([\\s\\S]*?)\\1`,
    "i"
  );
  if (attrRegex.test(attrs)) {
    return attrs.replace(attrRegex, ` ${attrName}="${String(attrValue)}"`);
  }
  return `${attrs} ${attrName}="${String(attrValue)}"`;
};

const upsertPageStyleAttr = (attrs = "", pageName = "") => {
  const styleRegex = /\sstyle=(["'])([\s\S]*?)\1/i;
  if (!styleRegex.test(attrs)) {
    return `${attrs} style="page:${String(pageName)};"`;
  }

  return attrs.replace(styleRegex, (fullMatch, quote, styleValue) => {
    const cleaned = String(styleValue)
      .replace(/(?:^|;)\s*page\s*:\s*[^;]+;?/gi, ";")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^;+|;+$/g, "");
    const prefix = cleaned ? `${cleaned}; ` : "";
    return ` style="${prefix}page:${String(pageName)};"`;
  });
};

const ensureSheetPageMarkup = (rawHtml, { sizeKey, pageName }) => {
  const safeHtml = String(rawHtml || "").trim();
  if (!safeHtml) return "";
  const sectionRegex = /<section([^>]*class=["'][^"']*\bcilt-print-sheet\b[^"']*["'][^>]*)>/i;
  if (!sectionRegex.test(safeHtml)) {
    return `<section class="cilt-print-sheet" data-page-size="${sizeKey}" style="page:${pageName};">${safeHtml}</section>`;
  }

  return safeHtml.replace(sectionRegex, (fullMatch, attrs) => {
    let nextAttrs = attrs;
    nextAttrs = upsertHtmlAttr(nextAttrs, "data-page-size", sizeKey);
    nextAttrs = upsertPageStyleAttr(nextAttrs, pageName);
    return `<section${nextAttrs}>`;
  });
};

const buildInlinePrintHtmlDocument = ({ sheets = [], extraStyles = "" }) => {
  const pageRules = Object.values(PAGE_SIZE_CONFIG)
    .map(
      (entry) => `@page ${entry.pageName} { size: ${entry.cssSize}; margin: 2.5mm; }`
    )
    .join("\n");

  const sheetMarkup = (Array.isArray(sheets) ? sheets : [])
    .map((sheet) => {
      const sizeKey = normalizePageSize(sheet?.pageSize);
      const pageName = PAGE_SIZE_CONFIG[sizeKey].pageName;
      const rawHtml = stripScriptTags(sheet?.html || "").trim();
      if (!rawHtml) return "";
      return ensureSheetPageMarkup(rawHtml, { sizeKey, pageName });
    })
    .filter(Boolean)
    .join("\n");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CILTpro PDF</title>
    <style>
      ${pageRules}
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #111827;
        font-family: Arial, sans-serif;
        line-height: 1.25;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .cilt-print-sheet {
        width: 100%;
        box-sizing: border-box;
        break-after: page;
        page-break-after: always;
      }
      .cilt-print-sheet:last-child {
        break-after: auto;
        page-break-after: auto;
      }
      .cilt-print-sheet * {
        box-sizing: border-box;
      }
      ${String(extraStyles || "")}
    </style>
  </head>
  <body>
    ${sheetMarkup}
  </body>
</html>`;
};

const renderInlineChunkToPdf = async ({ page, sheets = [], extraStyles = "", outputPath }) => {
  const normalizedSheets = Array.isArray(sheets) ? sheets.filter(Boolean) : [];
  if (normalizedSheets.length === 0) {
    throw withStageError(
      "fallback-no-sheets",
      "Inline fallback received empty sheet payload."
    );
  }
  const startedAt = Date.now();
  const html = buildInlinePrintHtmlDocument({ sheets: normalizedSheets, extraStyles });
  try {
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: PRINT_READY_TIMEOUT_MS,
    });
  } catch (error) {
    throw withStageError("fallback-set-content", error);
  }
  const gotoDoneAt = Date.now();
  await page.emulateMedia({ media: "print" });
  const readyDoneAt = Date.now();
  const fontsDoneAt = Date.now();
  await renderCurrentPageToPdf(page, outputPath, "fallback-generate-pdf");
  const pdfDoneAt = Date.now();
  return buildChunkTiming({
    mode: "inline",
    startedAt,
    gotoDoneAt,
    readyDoneAt,
    fontsDoneAt,
    pdfDoneAt,
  });
};

const isRouteRecoverableError = (error) => {
  const stage = String(error?.stage || "").trim();
  if (!stage) return false;
  return (
    stage === "goto-print-route" ||
    stage === "wait-print-ready" ||
    stage === "print-route-ready-state"
  );
};

const renderSheetChunkToPdf = async ({
  page,
  printRouteUrl,
  sheets = [],
  extraStyles = "",
  outputPath,
}) => {
  let routeWaitState = "";
  try {
    const startedAt = Date.now();
    try {
      const gotoResponse = await page.goto(printRouteUrl, {
        waitUntil: "domcontentloaded",
        timeout: PRINT_READY_TIMEOUT_MS,
      });
      const status = Number(gotoResponse?.status?.());
      if (Number.isFinite(status) && status >= 400) {
        throw new Error(`Print route HTTP ${status} at ${printRouteUrl}`);
      }
      const expectedPath = normalizePathname(printRouteUrl);
      const landedUrl = page.url();
      const landedPath = normalizePathname(landedUrl);
      if (expectedPath && landedPath && expectedPath !== landedPath) {
        throw new Error(
          `Print route redirected to unexpected path (${landedPath}) at ${landedUrl}`
        );
      }
    } catch (error) {
      throw withStageError("goto-print-route", error);
    }
    const gotoDoneAt = Date.now();
    try {
      await page.waitForSelector("[data-cilt-print-ready]", {
        state: "attached",
        timeout: PRINT_READY_TIMEOUT_MS,
      });
      try {
        await page.waitForFunction(
          () => {
            const node = document.querySelector("[data-cilt-print-ready]");
            if (!node) return false;
            const state = (node.getAttribute("data-cilt-print-ready") || "").trim();
            return state === "1" || state === "0" || state === "-1";
          },
          { timeout: PRINT_READY_TIMEOUT_MS }
        );
      } catch (stateError) {
        throw withStageError("print-route-ready-state", stateError);
      }
    } catch (error) {
      let pageTitle = "";
      let pageSnippet = "";
      let currentUrl = "";
      try {
        currentUrl = page.url();
      } catch (readErr) {
        currentUrl = "";
      }
      try {
        pageTitle = await page.title();
      } catch (readErr) {
        pageTitle = "";
      }
      try {
        pageSnippet = String(await page.content())
          .replace(/\s+/g, " ")
          .slice(0, 260);
      } catch (readErr) {
        pageSnippet = "";
      }
      throw withStageError(
        "wait-print-ready",
        `${compactErrorMessage(error)} | url=${currentUrl} | title=${pageTitle} | snippet=${pageSnippet}`
      );
    }
    const readyState = await page.$eval(
      "[data-cilt-print-ready]",
      (node) => node.getAttribute("data-cilt-print-ready") || ""
    );
    routeWaitState = String(readyState || "").trim();
    if (readyState !== "1") {
      let routeError = "";
      try {
        routeError = await page.$eval(
          "[data-cilt-print-error]",
          (node) => node.textContent || ""
        );
      } catch (error) {
        routeError = "";
      }
      throw withStageError(
        "print-route-ready-state",
        `Print route render failed (state=${routeWaitState || "-"}${
          routeError ? `, error=${routeError.trim()}` : ""
        }).`
      );
    }
    const readyDoneAt = Date.now();
    try {
      try {
        await page.waitForFunction(
          () => (document.fonts ? document.fonts.status === "loaded" : true),
          { timeout: PRINT_FONT_WAIT_TIMEOUT_MS }
        );
      } catch (error) {
        throw withStageError("wait-fonts", error);
      }
    } catch (error) {
      // Continue even if font readiness check times out.
    }
    const fontsDoneAt = Date.now();
    await page.emulateMedia({ media: "print" });
    await renderCurrentPageToPdf(page, outputPath, "generate-pdf");
    const pdfDoneAt = Date.now();
    return buildChunkTiming({
      mode: "print-route",
      startedAt,
      gotoDoneAt,
      readyDoneAt,
      fontsDoneAt,
      pdfDoneAt,
    });
  } catch (error) {
    if (!isRouteRecoverableError(error)) throw error;
    // eslint-disable-next-line no-console
    console.warn(
      `Print route failed, fallback to inline chunk render: ${compactErrorMessage(
        error
      )}`
    );
    const fallbackTiming = await renderInlineChunkToPdf({
      page,
      sheets,
      extraStyles,
      outputPath,
    });
    return {
      ...fallbackTiming,
      mode: "route-fallback-inline",
    };
  }
};

const mergePdfFiles = async (chunkPaths = [], outputPath) => {
  if (!Array.isArray(chunkPaths) || chunkPaths.length === 0) {
    throw new Error("No chunk PDFs to merge.");
  }

  const mergedPdf = await PDFDocument.create();
  for (const chunkPath of chunkPaths) {
    const bytes = await fs.promises.readFile(chunkPath);
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((copiedPage) => mergedPdf.addPage(copiedPage));
  }
  mergedPdf.setTitle(PDF_METADATA_TITLE, { showInWindowTitleBar: true });
  const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
  await fs.promises.writeFile(outputPath, mergedBytes);
};

const runJob = async (jobId) => {
  const job = jobs.get(jobId);
  if (!job || job.status !== "queued") return;

  const chunkOutputPaths = [];
  const jobRunStartedAt = Date.now();
  let prepareMs = 0;
  let renderMs = 0;
  let mergeMs = 0;
  let renderWorkerCount = 1;
  try {
    ensureJobNotCancelled(job);
    job.status = "processing";
    job.progress = Math.max(job.progress || 0, 5);
    job.startedAt = nowIso();
    job.message = "Preparing printable content...";

    if ((!Array.isArray(job.sheets) || job.sheets.length === 0) && job.sourceItems?.length) {
      const prepareStartedAt = Date.now();
      await prepareSheetsForJob(job);
      prepareMs = Date.now() - prepareStartedAt;
      job.metrics = {
        ...(job.metrics || {}),
        prepareMs,
      };
      // eslint-disable-next-line no-console
      console.log(`Job ${jobId} prepare stage: ${formatMs(prepareMs)}`);
      ensureJobNotCancelled(job);
    }

    job.progress = Math.max(job.progress || 0, 12);
    job.message = "Preparing renderer...";

    const chromium = getPlaywrightChromium();
    if (!chromium) {
      throw new Error(
        "Playwright is not installed in backend. Install dependency 'playwright'."
      );
    }

    await ensureDir(JOB_OUTPUT_DIR);

    const browser = await getSharedBrowser(chromium);
    const chunkSize = Math.max(
      1,
      Math.min(Number(job.chunkSize) || MAX_SHEETS_PER_CHUNK, MAX_SHEETS_PER_CHUNK)
    );
    const renderMode = normalizeRenderMode(job.renderMode);
    const sheetChunks = splitIntoChunks(job.sheets, { chunkSize });
    renderWorkerCount = resolveRenderWorkerCount(sheetChunks.length);

    job.chunkSize = chunkSize;
    job.renderMode = renderMode;
    job.totalChunks = sheetChunks.length;
    job.processedChunks = 0;
    job.progress = Math.max(job.progress || 0, 12);
    job.message =
      sheetChunks.length > 1
        ? `Chunking ${job.totalSheets} sheets into ${sheetChunks.length} parts...`
        : "Rendering PDF pages...";

    // eslint-disable-next-line no-console
    console.log(
      `Rendering ${sheetChunks.length} chunk(s) with workerCount=${renderWorkerCount}, renderMode=${renderMode}, targetChunkHtmlChars=${TARGET_CHUNK_HTML_CHARS}`
    );

    let nextChunkIndex = 0;
    let firstRenderError = null;
    const renderStartedAt = Date.now();
    const renderChunkWorker = async () => {
      let workerContext = null;
      try {
        workerContext = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          deviceScaleFactor: 1,
        });
        activeRenderContexts += 1;
        const page = await workerContext.newPage();

        while (true) {
          if (firstRenderError) return;

          const chunkIndex = nextChunkIndex;
          nextChunkIndex += 1;
          if (chunkIndex >= sheetChunks.length) return;

          ensureJobNotCancelled(job);
          const chunk = sheetChunks[chunkIndex];
          const chunkSheets = chunk?.sheets || [];
          const chunkNumber = chunkIndex + 1;
          const chunkOffset = Number(chunk?.offset) || 0;
          const chunkSummary = summarizeSheets(chunkSheets);
          const chunkPath = path.join(
            JOB_OUTPUT_DIR,
            `${job.jobId}.chunk-${String(chunkNumber).padStart(4, "0")}.pdf`
          );
          const printRouteUrl = buildPrintRouteUrl({
            job,
            offset: chunkOffset,
            limit: Number(chunk?.limit) || chunkSheets.length,
          });

          const progressStart =
            12 + Math.round((job.processedChunks / sheetChunks.length) * 68);
          job.progress = Math.max(job.progress, progressStart);
          job.message =
            sheetChunks.length > 1
              ? `Rendering chunk ${chunkNumber}/${sheetChunks.length} (${chunkSheets.length} sheets)...`
              : "Rendering PDF pages...";
          // eslint-disable-next-line no-console
          console.log(
            `Chunk ${chunkNumber}/${sheetChunks.length} metadata: offset=${chunkOffset}, limit=${
              Number(chunk?.limit) || chunkSheets.length
            }, htmlChars=${chunkSummary.htmlChars}, maxSheetHtmlChars=${
              chunkSummary.maxSheetHtmlChars
            }, pageSizes=${chunkSummary.pageSizes}, sourceTypes=${chunkSummary.sourceTypes}, packageTypes=${chunkSummary.packageTypes}, itemIds=${chunkSummary.itemIds}`
          );

          const chunkTiming =
            renderMode === "inline"
              ? await renderInlineChunkToPdf({
                  page,
                  sheets: chunkSheets,
                  extraStyles: job.extraStyles,
                  outputPath: chunkPath,
                })
              : await renderSheetChunkToPdf({
                  page,
                  printRouteUrl,
                  sheets: chunkSheets,
                  extraStyles: job.extraStyles,
                  outputPath: chunkPath,
                });

          chunkOutputPaths[chunkIndex] = chunkPath;
          job.processedChunks += 1;
          const progressEnd =
            12 + Math.round((job.processedChunks / sheetChunks.length) * 68);
          job.progress = Math.max(job.progress, progressEnd);
          const timingSummary = `mode=${chunkTiming.mode}, nav=${formatMs(
            chunkTiming.gotoMs
          )}, ready=${formatMs(chunkTiming.readyMs)}, font=${formatMs(
            chunkTiming.fontsMs
          )}, pdf=${formatMs(chunkTiming.pdfMs)}, total=${formatMs(
            chunkTiming.totalMs
          )}`;
          job.message =
            sheetChunks.length > 1
              ? `Completed ${job.processedChunks}/${sheetChunks.length} chunks. Latest chunk ${chunkNumber}/${sheetChunks.length} (${timingSummary}).`
              : `PDF pages rendered (${timingSummary}).`;
          // eslint-disable-next-line no-console
          console.log(
            `Chunk ${chunkNumber}/${sheetChunks.length} (${chunkSheets.length} sheets): ${timingSummary}`
          );
        }
      } catch (error) {
        if (!firstRenderError) {
          firstRenderError = error;
        }
      } finally {
        if (workerContext) {
          try {
            await workerContext.close();
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`CILT PDF context close error (${jobId}): ${error.message}`);
          }
          activeRenderContexts = Math.max(0, activeRenderContexts - 1);
        }
      }
    };

    await Promise.all(
      Array.from({ length: renderWorkerCount }, () => renderChunkWorker())
    );

    if (firstRenderError) {
      throw firstRenderError;
    }
    renderMs = Date.now() - renderStartedAt;
    job.metrics = {
      ...(job.metrics || {}),
      prepareMs,
      renderMs,
    };
    // eslint-disable-next-line no-console
    console.log(`Job ${jobId} render stage: ${formatMs(renderMs)}`);

    ensureJobNotCancelled(job);
    job.progress = Math.max(job.progress, 85);
    job.message =
      chunkOutputPaths.length > 1
        ? `Merging ${chunkOutputPaths.length} chunk files...`
        : "Finalizing PDF file...";

    const outputPath = path.join(JOB_OUTPUT_DIR, `${job.jobId}.pdf`);
    const mergeStartedAt = Date.now();
    await mergePdfFiles(chunkOutputPaths.filter(Boolean), outputPath);
    mergeMs = Date.now() - mergeStartedAt;

    const stats = await fs.promises.stat(outputPath);
    const totalMs = Date.now() - jobRunStartedAt;
    job.sheets = [];
    job.sourceItems = [];
    job.extraStyles = "";
    job.outputPath = outputPath;
    job.outputSize = stats.size;
    job.chunkOutputCount = chunkOutputPaths.length;
    job.metrics = {
      ...(job.metrics || {}),
      prepareMs,
      renderMs,
      mergeMs,
      totalMs,
      outputBytes: stats.size,
      chunkCount: chunkOutputPaths.length,
      fetchConcurrency: job.fetchConcurrency || null,
      renderWorkerCount,
    };
    job.status = "completed";
    job.progress = 100;
    job.message = "PDF is ready.";
    job.completedAt = nowIso();
    job.error = null;
    // eslint-disable-next-line no-console
    console.log(
      `Job ${jobId} stage summary: prepare=${formatMs(prepareMs)}, render=${formatMs(
        renderMs
      )}, merge=${formatMs(mergeMs)}, total=${formatMs(totalMs)}, outputBytes=${stats.size}, chunkCount=${chunkOutputPaths.length}, fetchConcurrency=${job.fetchConcurrency || "-"}, renderWorkers=${renderWorkerCount}`
    );
  } catch (error) {
    job.metrics = {
      ...(job.metrics || {}),
      prepareMs,
      renderMs,
      mergeMs,
      totalMs: Date.now() - jobRunStartedAt,
      fetchConcurrency: job.fetchConcurrency || null,
      renderWorkerCount,
    };
    if (error?.code === "PDF_JOB_CANCELLED" || job?.cancelRequested) {
      job.status = "cancelled";
      job.progress = 100;
      job.message = "PDF job cancelled.";
      job.completedAt = nowIso();
      job.error = null;
    } else {
      job.status = "failed";
      job.progress = 100;
      job.message = "Failed to generate PDF.";
      job.completedAt = nowIso();
      job.error = sanitizeJobErrorMessage(error);
      // eslint-disable-next-line no-console
      console.error(
        `CILTpro PDF failed (${jobId}): ${job.error} | raw=${compactErrorMessage(
          error
        )}`
      );
    }
  } finally {
    for (const chunkPath of chunkOutputPaths) {
      if (!chunkPath) continue;
      try {
        await fs.promises.unlink(chunkPath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          // eslint-disable-next-line no-console
          console.error(`CILT PDF temp cleanup error (${jobId}): ${error.message}`);
        }
      }
    }
    scheduleSharedBrowserClose();
  }
};

const cleanupExpiredJobs = async () => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    const isTerminal =
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled";
    if (!isTerminal) continue;
    const endTs = new Date(job.completedAt || job.createdAt).getTime();
    if (!Number.isFinite(endTs)) continue;
    if (now - endTs < JOB_TTL_MS) continue;

    if (job.outputPath) {
      try {
        await fs.promises.unlink(job.outputPath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          // eslint-disable-next-line no-console
          console.error(`CILT PDF cleanup file error (${jobId}): ${error.message}`);
        }
      }
    }
    jobs.delete(jobId);
  }
};

const validateSheetsPayload = (sheets) => {
  if (!Array.isArray(sheets) || sheets.length === 0) {
    return "sheets is required and must be a non-empty array.";
  }
  if (sheets.length > MAX_SHEET_COUNT) {
    return `Too many sheets. Max allowed is ${MAX_SHEET_COUNT}.`;
  }
  let totalChars = 0;
  for (const sheet of sheets) {
    totalChars += String(sheet?.html || "").length;
    if (totalChars > MAX_HTML_PAYLOAD_CHARS) {
      return `HTML payload too large. Max allowed chars is ${MAX_HTML_PAYLOAD_CHARS}. Current payload chars: ${totalChars}.`;
    }
  }
  return null;
};

const normalizeChunkSize = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_SHEETS_PER_CHUNK;
  return Math.max(1, Math.min(Math.floor(parsed), MAX_SHEETS_PER_CHUNK));
};

const mapWithConcurrency = async (items = [], worker, concurrency = 1) => {
  const source = Array.isArray(items) ? items : [];
  if (source.length === 0) return [];

  const normalizedConcurrency = Math.max(
    1,
    Math.min(source.length, Number(concurrency) || 1)
  );
  const results = new Array(source.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= source.length) return;
      results[currentIndex] = await worker(source[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: normalizedConcurrency }, runWorker));
  return results;
};

const resolveItemFetchConcurrency = (itemCount = 0) => {
  const normalizedItemCount = Math.max(0, Number(itemCount) || 0);
  if (normalizedItemCount <= 1) return 1;
  if (ITEM_FETCH_CONCURRENCY_OVERRIDE) {
    return Math.min(ITEM_FETCH_CONCURRENCY_OVERRIDE, normalizedItemCount);
  }

  if (normalizedItemCount <= 12) {
    return Math.min(DEFAULT_ITEM_FETCH_CONCURRENCY, normalizedItemCount);
  }
  if (normalizedItemCount <= 40) {
    return Math.min(
      Math.max(4, DEFAULT_ITEM_FETCH_CONCURRENCY - 2),
      normalizedItemCount
    );
  }
  return Math.min(
    Math.max(3, Math.floor(DEFAULT_ITEM_FETCH_CONCURRENCY / 2)),
    normalizedItemCount
  );
};

const resolveRenderWorkerCount = (chunkCount = 0) => {
  const normalizedChunkCount = Math.max(0, Number(chunkCount) || 0);
  if (normalizedChunkCount <= 1) return 1;
  if (RENDER_CONCURRENCY_OVERRIDE) {
    return Math.min(RENDER_CONCURRENCY_OVERRIDE, normalizedChunkCount);
  }

  if (CPU_COUNT <= 2) {
    return 1;
  }

  if (normalizedChunkCount >= 4) {
    return 2;
  }

  return 1;
};

const loadRecordMapByIds = async ({
  ids = [],
  batchLoader,
  singleLoader,
  fetchConcurrency,
}) => {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    )
  );

  if (normalizedIds.length === 0) {
    return new Map();
  }

  if (typeof batchLoader === "function") {
    const loadedMap = await batchLoader(normalizedIds);
    return loadedMap instanceof Map ? loadedMap : new Map();
  }

  const loadedEntries = await mapWithConcurrency(
    normalizedIds,
    async (id) => [id, await singleLoader(id)],
    Math.min(fetchConcurrency, normalizedIds.length)
  );
  return new Map(loadedEntries.filter((entry) => entry?.[1]));
};

const prepareSheetsForJob = async (job) => {
  const sourceItems = Array.isArray(job?.sourceItems) ? job.sourceItems : [];
  if (sourceItems.length === 0) {
    return Array.isArray(job?.sheets) ? job.sheets : [];
  }

  const fetchConcurrency = resolveItemFetchConcurrency(sourceItems.length);
  job.fetchConcurrency = fetchConcurrency;
  job.progress = Math.max(job.progress || 0, 4);
  job.message = `Preparing ${sourceItems.length} printable pages...`;

  const ciltIds = [];
  const cipIds = [];
  sourceItems.forEach((item) => {
    const itemId = Number(item?.id);
    if (!Number.isFinite(itemId) || itemId <= 0) return;
    if (String(item?.sourceType || "").trim().toUpperCase() === "CIP") {
      cipIds.push(itemId);
    } else {
      ciltIds.push(itemId);
    }
  });

  const [ciltRecordsById, cipRecordsById] = await Promise.all([
    loadRecordMapByIds({
      ids: ciltIds,
      batchLoader:
        typeof ciltService.getCILTsByIds === "function"
          ? ciltService.getCILTsByIds.bind(ciltService)
          : null,
      singleLoader: (id) => ciltService.getCILT(id),
      fetchConcurrency,
    }),
    loadRecordMapByIds({
      ids: cipIds,
      batchLoader:
        typeof cipService.getCIPReportsByIds === "function"
          ? cipService.getCIPReportsByIds.bind(cipService)
          : null,
      singleLoader: (id) => cipService.getCIPReportById(id),
      fetchConcurrency,
    }),
  ]);

  const preparedSheets = sanitizeSheets(
    sourceItems
      .map((item) => {
        const itemId = Number(item?.id);
        const sourceType =
          String(item?.sourceType || "").trim().toUpperCase() === "CIP"
            ? "CIP"
            : "CILT";
        const record =
          sourceType === "CIP"
            ? cipRecordsById.get(itemId)
            : ciltRecordsById.get(itemId);

        if (!record) {
          throw new Error(`${sourceType} report id ${itemId} not found.`);
        }

        const packageType =
          sourceType === "CIP"
            ? "REPORT CIP"
            : String(record.packageType || "").trim() || "CILT REPORT";
        const builtSheet = buildV2SheetFromRecord({
          packageType: sourceType === "CIP" ? "REPORT CIP" : record.packageType,
          sourceType,
          record,
          headerMeta: item?.headerMeta,
          normalizePageSize,
        });
        return builtSheet
          ? {
              ...builtSheet,
              itemId,
              sourceType,
              packageType,
            }
          : null;
      })
      .filter(Boolean)
  );

  const validationError = validateSheetsPayload(preparedSheets);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  job.sheets = preparedSheets;
  job.totalSheets = preparedSheets.length;
  const estimatedChunks = splitIntoChunks(preparedSheets, {
    chunkSize: job.chunkSize,
  });
  job.totalChunks = Math.max(1, estimatedChunks.length);
  job.sourceItems = [];
  job.progress = Math.max(job.progress || 0, 10);
  job.message = `Prepared ${preparedSheets.length} printable pages.`;
  const preparedSummary = summarizeSheets(preparedSheets);

  // eslint-disable-next-line no-console
  console.log(
    `Prepared ${preparedSheets.length} PDF sheets with fetchConcurrency=${fetchConcurrency} (override=${
      ITEM_FETCH_CONCURRENCY_OVERRIDE || "-"
    }, cpu=${CPU_COUNT}) | htmlChars=${preparedSummary.htmlChars}, maxSheetHtmlChars=${
      preparedSummary.maxSheetHtmlChars
    }, pageSizes=${preparedSummary.pageSizes}, sourceTypes=${preparedSummary.sourceTypes}, packageTypes=${preparedSummary.packageTypes}, estimatedChunks=${estimatedChunks.length}, targetChunkHtmlChars=${TARGET_CHUNK_HTML_CHARS}`
  );

  return preparedSheets;
};

const createJobFromPreparedSheetsInternal = ({
  fileName,
  sheets,
  sourceItems = [],
  extraStyles = "",
  requestedBy,
  chunkSize,
  printBaseUrl,
  renderMode,
  jobSource = "v2-items",
}) => {
  const normalizedSourceItems = dedupeV2Items(sourceItems);
  const hasPreparedSheets = Array.isArray(sheets) && sheets.length > 0;
  let sanitizedSheets = [];
  if (hasPreparedSheets) {
    const validationError = validateSheetsPayload(sheets);
    if (validationError) {
      const error = new Error(validationError);
      error.statusCode = 400;
      throw error;
    }
    sanitizedSheets = sanitizeSheets(sheets);
  } else if (normalizedSourceItems.length === 0) {
    const error = new Error("items is required and must contain valid id/sourceType entries.");
    error.statusCode = 400;
    throw error;
  }

  const jobId = createJobId();
  const resolvedChunkSize = normalizeChunkSize(chunkSize);
  const requestedRenderMode = normalizeRenderMode(renderMode);
  const resolvedRenderMode = LOCKED_RENDER_MODE || requestedRenderMode;
  const resolvedPrintBaseUrl =
    normalizePrintBaseUrl(printBaseUrl) || normalizePrintBaseUrl(PRINT_BASE_URL);
  const totalSheets = hasPreparedSheets ? sanitizedSheets.length : normalizedSourceItems.length;
  const estimatedChunkCount = hasPreparedSheets
    ? Math.max(
        1,
        splitIntoChunks(sanitizedSheets, {
          chunkSize: resolvedChunkSize,
        }).length
      )
    : Math.max(1, Math.ceil(totalSheets / resolvedChunkSize));
  const job = {
    jobId,
    printToken: createJobToken(),
    status: "queued",
    progress: hasPreparedSheets ? 0 : 1,
    message: hasPreparedSheets
      ? "Job queued."
      : `Job queued. Preparing ${totalSheets} printable pages...`,
    cancelRequested: false,
    fileName: sanitizeFileName(fileName, `cilt-export-${jobId}.pdf`),
    requestedBy: String(requestedBy || "").trim() || "unknown",
    jobSource: String(jobSource || "v2-items").trim() || "v2-items",
    renderMode: resolvedRenderMode,
    printBaseUrl: resolvedPrintBaseUrl,
    totalSheets,
    chunkSize: resolvedChunkSize,
    totalChunks: estimatedChunkCount,
    processedChunks: 0,
    sourceItems: hasPreparedSheets ? [] : normalizedSourceItems,
    sheets: sanitizedSheets,
    extraStyles: String(extraStyles || ""),
    outputPath: null,
    outputSize: null,
    createdAt: nowIso(),
    startedAt: null,
    completedAt: null,
    error: null,
  };

  // eslint-disable-next-line no-console
  console.log(
    `Job created ${jobId}: totalSheets=${totalSheets}, requestedChunkSize=${String(
      chunkSize
    )}, resolvedChunkSize=${resolvedChunkSize}, requestedRenderMode=${requestedRenderMode}, resolvedRenderMode=${resolvedRenderMode}, lockRenderMode=${LOCKED_RENDER_MODE || "-"}, source=${job.jobSource}, printBase=${
      resolvedPrintBaseUrl || PRINT_BASE_URL
    }, deferredPreparation=${hasPreparedSheets ? "no" : "yes"}`
  );

  jobs.set(jobId, job);
  setImmediate(() => runJob(jobId));
  return toPublicJob(job);
};

const buildSheetsFromItems = async (items = []) => {
  const tempJob = {
    progress: 0,
    message: "",
    sourceItems: dedupeV2Items(items),
    sheets: [],
    chunkSize: MAX_SHEETS_PER_CHUNK,
  };
  return prepareSheetsForJob(tempJob);
};

const createJobFromItems = ({
  fileName,
  items,
  requestedBy,
  chunkSize,
  printBaseUrl,
  renderMode,
}) => {
  const normalizedItems = dedupeV2Items(items);
  if (normalizedItems.length === 0) {
    const error = new Error("items is required and must contain valid id/sourceType entries.");
    error.statusCode = 400;
    throw error;
  }
  if (normalizedItems.length > MAX_SHEET_COUNT) {
    const error = new Error(`Too many items. Max allowed is ${MAX_SHEET_COUNT}.`);
    error.statusCode = 400;
    throw error;
  }

  const resolvedFetchConcurrency = resolveItemFetchConcurrency(normalizedItems.length);
  const mergedExtraStyles = String(V2_RENDERER_STYLES || "");
  // eslint-disable-next-line no-console
  console.log(
    `Queueing ${normalizedItems.length} items for PDF preparation with fetchConcurrency=${resolvedFetchConcurrency} (override=${
      ITEM_FETCH_CONCURRENCY_OVERRIDE || "-"
    }, cpu=${CPU_COUNT})`
  );
  return createJobFromPreparedSheetsInternal({
    fileName,
    sourceItems: normalizedItems,
    extraStyles: mergedExtraStyles,
    requestedBy,
    chunkSize,
    printBaseUrl,
    renderMode,
    jobSource: "v2-items",
  });
};

const getJob = (jobId) => {
  const job = jobs.get(jobId);
  return job ? toPublicJob(job) : null;
};

const getJobInternal = (jobId) => jobs.get(jobId);

const getJobPrintPayload = (jobId, { token, offset, limit } = {}) => {
  const job = jobs.get(jobId);
  if (!job) {
    return { ok: false, statusCode: 404, error: "PDF job not found." };
  }
  if (!token || token !== job.printToken) {
    return { ok: false, statusCode: 403, error: "Invalid PDF print token." };
  }
  const sliceWindow = resolveSliceWindow(job.totalSheets, { offset, limit });
  const slicedSheets = sanitizeSheets(job.sheets.slice(sliceWindow.offset, sliceWindow.end));
  return {
    ok: true,
    payload: {
      jobId: job.jobId,
      fileName: job.fileName,
      requestedBy: job.requestedBy,
      status: job.status,
      totalSheets: job.totalSheets,
      offset: sliceWindow.offset,
      limit: sliceWindow.limit,
      end: sliceWindow.end,
      extraStyles: String(job.extraStyles || ""),
      sheets: slicedSheets,
    },
  };
};

const cancelJob = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return null;

  const statusToken = String(job.status || "").toLowerCase();
  if (statusToken === "completed" || statusToken === "failed" || statusToken === "cancelled") {
    return toPublicJob(job);
  }

  job.cancelRequested = true;
  if (statusToken === "queued") {
    job.status = "cancelled";
    job.progress = 100;
    job.message = "PDF job cancelled before processing.";
    job.completedAt = nowIso();
  } else {
    job.message = "Cancellation requested. Finishing current step...";
  }
  return toPublicJob(job);
};

const removeJob = async (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.outputPath) {
    try {
      await fs.promises.unlink(job.outputPath);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        // eslint-disable-next-line no-console
        console.error(`CILT PDF remove file error (${jobId}): ${error.message}`);
      }
    }
  }
  jobs.delete(jobId);
  return true;
};

const ensureCleanupLoop = () => {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    cleanupExpiredJobs().catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`CILT PDF cleanup loop error: ${error.message}`);
    });
  }, JOB_CLEANUP_INTERVAL_MS);
  if (!shutdownHookRegistered) {
    shutdownHookRegistered = true;
    process.once("beforeExit", () => {
      closeSharedBrowser().catch(() => {});
    });
  }
};

module.exports = {
  createJobFromItems,
  getJob,
  getJobInternal,
  getJobPrintPayload,
  cancelJob,
  removeJob,
  ensureCleanupLoop,
};
