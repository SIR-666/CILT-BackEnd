const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PDFDocument } = require("pdf-lib");

const PAGE_SIZE_CONFIG = {
  "A4 portrait": { pageName: "cilt-a4-portrait", cssSize: "A4 portrait" },
  "A4 landscape": { pageName: "cilt-a4-landscape", cssSize: "A4 landscape" },
  "A3 landscape": { pageName: "cilt-a3-landscape", cssSize: "A3 landscape" },
};

const DEFAULT_PAGE_SIZE = "A4 portrait";
const JOB_OUTPUT_DIR = path.join(__dirname, "..", "tmp", "cilt-pdf-jobs");
const JOB_TTL_MS = Number(process.env.CILT_PDF_JOB_TTL_MS || 60 * 60 * 1000);
const JOB_CLEANUP_INTERVAL_MS = Number(
  process.env.CILT_PDF_JOB_CLEANUP_INTERVAL_MS || 5 * 60 * 1000
);
const JOB_TIMEOUT_MS = Number(process.env.CILT_PDF_JOB_TIMEOUT_MS || 10 * 60 * 1000);
const MAX_SHEET_COUNT = Number(process.env.CILT_PDF_MAX_SHEETS || 500);
const MAX_SHEETS_PER_CHUNK = Number(process.env.CILT_PDF_SHEETS_PER_CHUNK || 24);
const MAX_HTML_PAYLOAD_CHARS = Number(
  process.env.CILT_PDF_MAX_HTML_CHARS || 20_000_000
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
  process.env.CILT_PDF_PRINT_BASE_URL || "http://localhost:3000"
).trim();
const PRINT_ROUTE_PATH = `/${String(
  process.env.CILT_PDF_PRINT_ROUTE_PATH || "ciltApproval/print-job"
)
  .trim()
  .replace(/^\/+|\/+$/g, "")}`;
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

const nowIso = () => new Date().toISOString();

const normalizePageSize = (value) =>
  PAGE_SIZE_CONFIG[value] ? value : DEFAULT_PAGE_SIZE;

const sanitizeFileName = (value, fallback = "cilt-export.pdf") => {
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

const toPublicJob = (job) => ({
  jobId: job.jobId,
  status: job.status,
  progress: job.progress,
  message: job.message,
  cancelRequested: Boolean(job.cancelRequested),
  fileName: job.fileName,
  requestedBy: job.requestedBy,
  totalSheets: job.totalSheets,
  chunkSize: job.chunkSize || null,
  totalChunks: job.totalChunks || null,
  processedChunks: job.processedChunks || 0,
  createdAt: job.createdAt,
  startedAt: job.startedAt || null,
  completedAt: job.completedAt || null,
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
  if (!PRINT_BASE_URL) {
    throw new Error("CILT_PDF_PRINT_BASE_URL is not configured.");
  }
  const normalizedBase = PRINT_BASE_URL.replace(/\/+$/g, "");
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
    return "Print route render failed. Check CILT_PDF_PRINT_BASE_URL and FE route /ciltApproval/print-job.";
  }

  if (lower.includes("timeout")) {
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
      console.log(`[CILT PDF] Launching browser via ${candidate.label}`);
      return await chromium.launch(candidate.options);
    } catch (error) {
      lastError = error;
      // eslint-disable-next-line no-console
      console.error(
        `[CILT PDF] Browser launch failed via ${candidate.label}: ${compactErrorMessage(
          error
        )}`
      );
    }
  }

  throw lastError || new Error("Unable to launch browser.");
};

const splitIntoChunks = (items = [], chunkSize = MAX_SHEETS_PER_CHUNK) => {
  const normalizedChunkSize = Math.max(1, Number(chunkSize) || MAX_SHEETS_PER_CHUNK);
  const chunks = [];
  for (let index = 0; index < items.length; index += normalizedChunkSize) {
    chunks.push(items.slice(index, index + normalizedChunkSize));
  }
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

const renderSheetChunkToPdf = async ({
  page,
  printRouteUrl,
  outputPath,
}) => {
  await page.goto(printRouteUrl, {
    waitUntil: "networkidle",
    timeout: JOB_TIMEOUT_MS,
  });
  await page.waitForSelector("[data-cilt-print-ready]", {
    timeout: JOB_TIMEOUT_MS,
  });
  const readyState = await page.$eval(
    "[data-cilt-print-ready]",
    (node) => node.getAttribute("data-cilt-print-ready") || ""
  );
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
    throw new Error(
      `Print route render failed${routeError ? `: ${routeError.trim()}` : "."}`
    );
  }
  try {
    await page.waitForFunction(
      () => (document.fonts ? document.fonts.status === "loaded" : true),
      { timeout: JOB_TIMEOUT_MS }
    );
  } catch (error) {
    // Continue even if font readiness check times out.
  }
  await page.emulateMedia({ media: "print" });

  await page.pdf({
    path: outputPath,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    timeout: JOB_TIMEOUT_MS,
  });
};

const mergePdfFiles = async (chunkPaths = [], outputPath) => {
  if (!Array.isArray(chunkPaths) || chunkPaths.length === 0) {
    throw new Error("No chunk PDFs to merge.");
  }
  if (chunkPaths.length === 1) {
    await fs.promises.rename(chunkPaths[0], outputPath);
    return;
  }

  const mergedPdf = await PDFDocument.create();
  for (const chunkPath of chunkPaths) {
    const bytes = await fs.promises.readFile(chunkPath);
    const sourcePdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pageIndices = sourcePdf.getPageIndices();
    const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
    copiedPages.forEach((copiedPage) => mergedPdf.addPage(copiedPage));
  }
  const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
  await fs.promises.writeFile(outputPath, mergedBytes);
};

const runJob = async (jobId) => {
  const job = jobs.get(jobId);
  if (!job || job.status !== "queued") return;

  let browser = null;
  let context = null;
  const chunkOutputPaths = [];
  try {
    ensureJobNotCancelled(job);
    job.status = "processing";
    job.progress = 5;
    job.startedAt = nowIso();
    job.message = "Preparing renderer...";

    const chromium = getPlaywrightChromium();
    if (!chromium) {
      throw new Error(
        "Playwright is not installed in backend. Install dependency 'playwright'."
      );
    }

    await ensureDir(JOB_OUTPUT_DIR);

    browser = await launchBrowserWithFallback(chromium);
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    const chunkSize = Math.max(
      1,
      Math.min(Number(job.chunkSize) || MAX_SHEETS_PER_CHUNK, 100)
    );
    const sheetChunks = splitIntoChunks(job.sheets, chunkSize);
    job.chunkSize = chunkSize;
    job.totalChunks = sheetChunks.length;
    job.processedChunks = 0;
    job.progress = 12;
    job.message =
      sheetChunks.length > 1
        ? `Chunking ${job.totalSheets} sheets into ${sheetChunks.length} parts...`
        : "Rendering PDF pages...";

    for (let chunkIndex = 0; chunkIndex < sheetChunks.length; chunkIndex += 1) {
      ensureJobNotCancelled(job);
      const chunkSheets = sheetChunks[chunkIndex];
      const chunkNumber = chunkIndex + 1;
      const chunkOffset = chunkIndex * chunkSize;
      const chunkPath = path.join(
        JOB_OUTPUT_DIR,
        `${job.jobId}.chunk-${String(chunkNumber).padStart(4, "0")}.pdf`
      );
      chunkOutputPaths.push(chunkPath);
      const printRouteUrl = buildPrintRouteUrl({
        job,
        offset: chunkOffset,
        limit: chunkSheets.length,
      });

      const progressStart = 12 + Math.round((chunkIndex / sheetChunks.length) * 68);
      job.progress = Math.max(job.progress, progressStart);
      job.message =
        sheetChunks.length > 1
          ? `Rendering chunk ${chunkNumber}/${sheetChunks.length} (${chunkSheets.length} sheets)...`
          : "Rendering PDF pages...";

      await renderSheetChunkToPdf({
        page,
        printRouteUrl,
        outputPath: chunkPath,
      });

      job.processedChunks = chunkNumber;
      const progressEnd = 12 + Math.round((chunkNumber / sheetChunks.length) * 68);
      job.progress = Math.max(job.progress, progressEnd);
      job.message =
        sheetChunks.length > 1
          ? `Chunk ${chunkNumber}/${sheetChunks.length} completed.`
          : "PDF pages rendered.";
    }

    ensureJobNotCancelled(job);
    job.progress = Math.max(job.progress, 85);
    job.message =
      chunkOutputPaths.length > 1
        ? `Merging ${chunkOutputPaths.length} chunk files...`
        : "Finalizing PDF file...";

    const outputPath = path.join(JOB_OUTPUT_DIR, `${job.jobId}.pdf`);
    await mergePdfFiles(chunkOutputPaths, outputPath);

    const stats = await fs.promises.stat(outputPath);
    job.sheets = [];
    job.extraStyles = "";
    job.outputPath = outputPath;
    job.outputSize = stats.size;
    job.chunkOutputCount = chunkOutputPaths.length;
    job.status = "completed";
    job.progress = 100;
    job.message = "PDF is ready.";
    job.completedAt = nowIso();
    job.error = null;
  } catch (error) {
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
        `CILT PDF Job failed (${jobId}): ${job.error} | raw=${compactErrorMessage(
          error
        )}`
      );
    }
  } finally {
    for (const chunkPath of chunkOutputPaths) {
      try {
        await fs.promises.unlink(chunkPath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          // eslint-disable-next-line no-console
          console.error(`CILT PDF temp cleanup error (${jobId}): ${error.message}`);
        }
      }
    }
    if (context) {
      try {
        await context.close();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`CILT PDF context close error (${jobId}): ${error.message}`);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`CILT PDF browser close error (${jobId}): ${error.message}`);
      }
    }
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
      return `HTML payload too large. Max allowed chars is ${MAX_HTML_PAYLOAD_CHARS}.`;
    }
  }
  return null;
};

const normalizeChunkSize = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_SHEETS_PER_CHUNK;
  return Math.max(1, Math.min(Math.floor(parsed), 100));
};

const createJob = ({ fileName, sheets, extraStyles = "", requestedBy, chunkSize }) => {
  const validationError = validateSheetsPayload(sheets);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const jobId = createJobId();
  const resolvedChunkSize = normalizeChunkSize(chunkSize);
  const sanitizedSheets = sanitizeSheets(sheets);
  const job = {
    jobId,
    printToken: createJobToken(),
    status: "queued",
    progress: 0,
    message: "Job queued.",
    cancelRequested: false,
    fileName: sanitizeFileName(fileName, `cilt-export-${jobId}.pdf`),
    requestedBy: String(requestedBy || "").trim() || "unknown",
    totalSheets: sanitizedSheets.length,
    chunkSize: resolvedChunkSize,
    totalChunks: Math.max(1, Math.ceil(sanitizedSheets.length / resolvedChunkSize)),
    processedChunks: 0,
    sheets: sanitizedSheets,
    extraStyles: String(extraStyles || ""),
    outputPath: null,
    outputSize: null,
    createdAt: nowIso(),
    startedAt: null,
    completedAt: null,
    error: null,
  };

  jobs.set(jobId, job);
  setImmediate(() => runJob(jobId));
  return toPublicJob(job);
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
};

module.exports = {
  createJob,
  getJob,
  getJobInternal,
  getJobPrintPayload,
  cancelJob,
  removeJob,
  ensureCleanupLoop,
};
