const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PDFDocument } = require("pdf-lib");
const ciltService = require("./ciltService");
const cipService = require("./cipService");

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
  process.env.CILT_PDF_MAX_HTML_CHARS || 80_000_000
);
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
const V2_SUPPORTED_PACKAGE_TYPES = new Set(["CHECKLIST CILT", "REPORT CIP"]);
const V2_HEADER_META_DEFAULTS = {
  "CHECKLIST CILT": {
    frm: "FIL - 015",
    rev: "00",
    berlaku: "01 - April - 2025",
    hal: "1 dari 5",
  },
  "REPORT CIP": {
    frm: "FIL - 009",
    rev: "00",
    berlaku: "21 - Jul - 2023",
    hal: "1 dari 3",
  },
};
const V2_RENDERER_STYLES = `
  .header-container {
    --rh-logo-col: 19%;
    --rh-company-col: 61%;
    --rh-meta-col: 20%;
    --rh-title-label-col: 19%;
    --rh-title-content-col: 61%;
    --rh-title-meta-col: 20%;
    border: 1px solid #d7d7d7;
    border-radius: 8px;
    background: #fff;
    margin-bottom: 12px;
    overflow: hidden;
  }
  .header-container.a4-portrait {
    --rh-logo-col: 24%;
    --rh-company-col: 54%;
    --rh-meta-col: 22%;
    --rh-title-label-col: 24%;
    --rh-title-content-col: 54%;
    --rh-title-meta-col: 22%;
  }
  .header-container.a4-landscape {
    --rh-logo-col: 19%;
    --rh-company-col: 61%;
    --rh-meta-col: 20%;
    --rh-title-label-col: 19%;
    --rh-title-content-col: 61%;
    --rh-title-meta-col: 20%;
  }
  .header-container.a3-landscape {
    --rh-logo-col: 17%;
    --rh-company-col: 63%;
    --rh-meta-col: 20%;
    --rh-title-label-col: 17%;
    --rh-title-content-col: 63%;
    --rh-title-meta-col: 20%;
  }
  .header-main-table,
  .header-title-table,
  .meta-info-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .logo-section {
    width: var(--rh-logo-col);
    text-align: center;
    vertical-align: middle;
    padding: 8px;
  }
  .logo-text {
    font-weight: 700;
    font-size: 36px;
    color: #2f8e3b;
    font-style: italic;
    font-family: "Times New Roman", serif;
  }
  .company-section {
    width: var(--rh-company-col);
    text-align: center;
    vertical-align: middle;
    padding: 8px 16px;
  }
  .company-name {
    font-size: 16px;
    font-weight: 700;
    color: #1f2937;
  }
  .meta-section {
    width: var(--rh-meta-col);
    padding: 6px 10px;
    border-left: 1px solid #e5e5e5;
  }
  .meta-info-table td {
    padding: 1px 0;
    font-size: 10.5px;
    line-height: 1.25;
    vertical-align: top;
  }
  .meta-label {
    width: 48px;
    font-weight: 700;
  }
  .meta-colon {
    width: 8px;
    text-align: center;
  }
  .meta-value {
    font-weight: 700;
  }
  .header-title-table {
    border-top: 1px solid #e5e5e5;
  }
  .title-label {
    width: var(--rh-title-label-col);
    padding: 4px 8px;
    text-align: center;
    font-weight: 700;
    font-size: 11px;
    border-right: 1px solid #e5e5e5;
    background: #fafafa;
  }
  .title-content {
    width: var(--rh-title-content-col);
    padding: 4px 12px;
    text-align: center;
    font-weight: 700;
    font-size: 12px;
  }
  .title-meta-spacer {
    width: var(--rh-title-meta-col);
    border-left: 1px solid #e5e5e5;
    background: #fafafa;
  }
  .report-info {
    margin-bottom: 10px;
  }
  .report-process-order {
    margin: 0 0 6px;
    font-size: 11px;
    color: #111827;
  }
  .general-info-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10.5px;
  }
  .general-info-table td {
    border: 1px solid #000;
    padding: 5px 7px;
    vertical-align: top;
  }
  .v2-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
  }
  .v2-table th,
  .v2-table td {
    border: 1px solid #000;
    padding: 5px 6px;
    vertical-align: top;
  }
  .v2-table th {
    background: #f2f2f2;
    font-weight: 700;
    text-align: center;
  }
  .v2-table td.left {
    text-align: left;
  }
  .v2-table td.center {
    text-align: center;
  }
  .v2-empty {
    text-align: center !important;
    color: #6b7280;
    font-style: italic;
  }
  .cip-title {
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 700;
  }
  .cip-line {
    margin: 0;
    font-size: 11px;
  }
  .cip-section-title {
    margin: 10px 0 6px;
    font-weight: 700;
    font-size: 11px;
  }
`;

const toUpperTrim = (value) => String(value || "").trim().toUpperCase();
const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const toDisplayText = (value, fallback = "-") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
};

const isMeaningfulSubmitterText = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return !["-", "null", "undefined", "n/a", "na"].includes(normalized);
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return [];
};

const formatDateTimeForPrint = (value) => {
  if (!value) return "-";
  const parsed = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "-";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
};

const normalizeSourceType = (value) => {
  const normalized = toUpperTrim(value);
  if (normalized === "CIP") return "CIP";
  return "CILT";
};

const normalizePackageType = (value) => toUpperTrim(value);

const resolveSubmittedBy = ({ record, inspectionRows = [] }) => {
  const candidateKeys = [
    "submittedBy",
    "submitBy",
    "submitted_by",
    "submit_by",
    "submitter",
    "submittedUser",
    "submitted_user",
    "username",
    "userName",
    "user_name",
    "createdBy",
    "created_by",
    "approval_coor_by",
    "approval_spv_by",
    "operator",
    "user",
  ];

  for (const key of candidateKeys) {
    const value = record?.[key];
    if (isMeaningfulSubmitterText(value)) return toDisplayText(value);
  }

  for (const row of inspectionRows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    for (const key of candidateKeys) {
      const value = row?.[key];
      if (isMeaningfulSubmitterText(value)) return toDisplayText(value);
    }
  }

  return "-";
};

const resolveV2HeaderMeta = (packageType, extraMeta = {}) => {
  const defaults = V2_HEADER_META_DEFAULTS[packageType] || {
    frm: "-",
    rev: "-",
    berlaku: "-",
    hal: "-",
  };
  return {
    frm: toDisplayText(extraMeta?.frm || defaults.frm),
    rev: toDisplayText(extraMeta?.rev || defaults.rev),
    berlaku: toDisplayText(extraMeta?.berlaku || defaults.berlaku),
    hal: toDisplayText(extraMeta?.hal || defaults.hal),
  };
};

const getHeaderPageClass = (pageSize) => {
  const normalized = normalizePageSize(pageSize);
  if (normalized === "A4 landscape") return "a4-landscape";
  if (normalized === "A3 landscape") return "a3-landscape";
  return "a4-portrait";
};

const renderV2ReportHeader = ({ title, pageSize, headerMeta }) => {
  const pageClass = getHeaderPageClass(pageSize);
  return `
    <div class="header-container ${escapeHtml(pageClass)}">
      <table class="header-main-table">
        <tr>
          <td class="logo-section"><span class="logo-text">Greenfields</span></td>
          <td class="company-section"><div class="company-name">PT. GREENFIELDS INDONESIA</div></td>
          <td class="meta-section">
            <table class="meta-info-table">
              <tr><td class="meta-label">FRM</td><td class="meta-colon">:</td><td class="meta-value">${escapeHtml(
                headerMeta.frm
              )}</td></tr>
              <tr><td class="meta-label">Rev</td><td class="meta-colon">:</td><td class="meta-value">${escapeHtml(
                headerMeta.rev
              )}</td></tr>
              <tr><td class="meta-label">Berlaku</td><td class="meta-colon">:</td><td class="meta-value">${escapeHtml(
                headerMeta.berlaku
              )}</td></tr>
              <tr><td class="meta-label">Hal</td><td class="meta-colon">:</td><td class="meta-value">${escapeHtml(
                headerMeta.hal
              )}</td></tr>
            </table>
          </td>
        </tr>
      </table>
      <table class="header-title-table">
        <tr>
          <td class="title-label">JUDUL</td>
          <td class="title-content">${escapeHtml(title || "-")}</td>
          <td class="title-meta-spacer"></td>
        </tr>
      </table>
    </div>
  `;
};

const renderV2GeneralInfoTable = ({ record, submittedBy, packageType }) => `
  <table class="general-info-table">
    <tbody>
      <tr>
        <td><strong>Date:</strong> ${escapeHtml(formatDateTimeForPrint(record?.date))}</td>
        <td><strong>Product:</strong> ${escapeHtml(toDisplayText(record?.product || record?.cipType))}</td>
      </tr>
      <tr>
        <td><strong>Plant:</strong> ${escapeHtml(toDisplayText(record?.plant, "Milk Filling Packing"))}</td>
        <td><strong>Line:</strong> ${escapeHtml(toDisplayText(record?.line))}</td>
      </tr>
      <tr>
        <td><strong>Machine:</strong> ${escapeHtml(toDisplayText(record?.machine || record?.posisi || "FILLER"))}</td>
        <td><strong>Shift:</strong> ${escapeHtml(toDisplayText(record?.shift))}</td>
      </tr>
      <tr>
        <td><strong>Submitted By:</strong> ${escapeHtml(toDisplayText(submittedBy))}</td>
        <td><strong>Package:</strong> ${escapeHtml(packageType)}</td>
      </tr>
    </tbody>
  </table>
`;

const normalizeChecklistRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      jobType: toDisplayText(row?.job_type ?? row?.jobType ?? row?.activity, ""),
      component: toDisplayText(row?.componen ?? row?.component ?? row?.equipment, ""),
      result: toDisplayText(row?.results ?? row?.result ?? row?.status, ""),
      user: toDisplayText(row?.user, ""),
      time: toDisplayText(row?.time, ""),
    }));

const renderChecklistTableHtml = (rows = []) => {
  const safeRows = normalizeChecklistRows(rows);
  const rowMarkup =
    safeRows.length > 0
      ? safeRows
          .map(
            (row, index) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td class="left">${escapeHtml(toDisplayText(row.jobType, "-"))}</td>
                <td class="left">${escapeHtml(toDisplayText(row.component, "-"))}</td>
                <td class="center">${escapeHtml(toDisplayText(row.result, "-"))}</td>
              </tr>
            `
          )
          .join("")
      : '<tr><td class="v2-empty" colspan="4">Tidak ada data inspeksi</td></tr>';

  return `
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:7%;">No</th>
          <th style="width:37%; text-align:left;">Job Type</th>
          <th style="width:38%; text-align:left;">Component</th>
          <th style="width:18%;">Result</th>
        </tr>
      </thead>
      <tbody>${rowMarkup}</tbody>
    </table>
  `;
};

const normalizeCipSteps = (record = {}) => {
  const steps = parseJsonArray(record?.steps || record?.cip_steps || record?.stepsData);
  return steps
    .filter((step) => step && typeof step === "object" && !Array.isArray(step))
    .map((step, index) => ({
      no: step?.no ?? index + 1,
      stepName: toDisplayText(step?.stepName ?? step?.step_name ?? step?.stepType ?? step?.step_type),
      target: toDisplayText(step?.target ?? step?.targetValue ?? step?.tempMin),
      actual: toDisplayText(step?.actual ?? step?.actualValue ?? step?.tempActual),
      duration: toDisplayText(step?.duration ?? step?.time),
    }));
};

const normalizeCipSpecialRecords = (record = {}) => {
  const copRecords = parseJsonArray(record?.copRecords || record?.cop_records);
  const specialRecords = parseJsonArray(record?.specialRecords || record?.special_records);
  const merged = [...copRecords, ...specialRecords];
  return merged
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      type: toDisplayText(entry?.stepType ?? entry?.step_type ?? entry?.type),
      temp: toDisplayText(entry?.tempActual ?? entry?.temp_actual),
      conc: toDisplayText(entry?.concActual ?? entry?.conc_actual),
      start: toDisplayText(entry?.startTime ?? entry?.start_time),
      end: toDisplayText(entry?.endTime ?? entry?.end_time),
    }));
};

const renderCipContentHtml = (record = {}) => {
  const steps = normalizeCipSteps(record);
  const specials = normalizeCipSpecialRecords(record);
  const stepRows =
    steps.length > 0
      ? steps
          .map(
            (row) => `
              <tr>
                <td class="center">${escapeHtml(toDisplayText(row.no))}</td>
                <td class="left">${escapeHtml(row.stepName)}</td>
                <td class="center">${escapeHtml(row.target)}</td>
                <td class="center">${escapeHtml(row.actual)}</td>
                <td class="center">${escapeHtml(row.duration)}</td>
              </tr>
            `
          )
          .join("")
      : '<tr><td class="v2-empty" colspan="5">No CIP step data available</td></tr>';

  const specialRows =
    specials.length > 0
      ? specials
          .map(
            (row) => `
              <tr>
                <td class="left">${escapeHtml(row.type)}</td>
                <td class="center">${escapeHtml(row.temp)}</td>
                <td class="center">${escapeHtml(row.conc)}</td>
                <td class="center">${escapeHtml(row.start)}</td>
                <td class="center">${escapeHtml(row.end)}</td>
              </tr>
            `
          )
          .join("")
      : '<tr><td class="v2-empty" colspan="5">No special records</td></tr>';

  return `
    <p class="cip-title">CIP Type: ${escapeHtml(toDisplayText(record?.cipType || record?.cip_type))}</p>
    <p class="cip-line">Posisi: ${escapeHtml(toDisplayText(record?.posisi))}</p>
    <p class="cip-line">Operator: ${escapeHtml(toDisplayText(record?.operator))}</p>
    <p class="cip-line">Status: ${escapeHtml(toDisplayText(record?.status))}</p>
    <p class="cip-line">Flow Rate: ${escapeHtml(toDisplayText(record?.flowRate || record?.flow_rate, "-"))}</p>
    <p class="cip-line">Flow Rate D/BC: ${escapeHtml(
      `${toDisplayText(record?.flowRateD || record?.flow_rate_d, "-")} / ${toDisplayText(
        record?.flowRateBC || record?.flow_rate_bc,
        "-"
      )}`
    )}</p>
    <p class="cip-section-title">CIP Steps</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:8%;">No</th>
          <th style="width:40%; text-align:left;">Step</th>
          <th style="width:17%;">Target</th>
          <th style="width:17%;">Actual</th>
          <th style="width:18%;">Duration</th>
        </tr>
      </thead>
      <tbody>${stepRows}</tbody>
    </table>
    <p class="cip-section-title">Special Records</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:32%; text-align:left;">Type</th>
          <th style="width:17%;">Temp</th>
          <th style="width:17%;">Conc</th>
          <th style="width:17%;">Start</th>
          <th style="width:17%;">End</th>
        </tr>
      </thead>
      <tbody>${specialRows}</tbody>
    </table>
  `;
};

const dedupeV2Items = (items = []) => {
  const deduped = [];
  const seen = new Set();
  for (const rawItem of Array.isArray(items) ? items : []) {
    const id = Number(rawItem?.id);
    if (!Number.isFinite(id) || id <= 0) continue;
    const sourceType = normalizeSourceType(rawItem?.sourceType || rawItem?.source);
    const key = `${sourceType}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      id: Math.floor(id),
      sourceType,
      packageType: normalizePackageType(rawItem?.packageType),
      headerMeta: rawItem?.headerMeta && typeof rawItem.headerMeta === "object" ? rawItem.headerMeta : {},
    });
  }
  return deduped;
};

const isCipItemDescriptor = (item = {}) =>
  normalizeSourceType(item?.sourceType) === "CIP" ||
  normalizePackageType(item?.packageType) === "REPORT CIP";

const fetchV2RecordByItem = async (item = {}) => {
  if (isCipItemDescriptor(item)) {
    const record = await cipService.getCIPReportById(item.id);
    if (!record) {
      throw new Error(`CIP report id ${item.id} not found.`);
    }
    return {
      sourceType: "CIP",
      packageType: "REPORT CIP",
      record,
    };
  }

  const record = await ciltService.getCILT(item.id);
  if (!record) {
    throw new Error(`CILT report id ${item.id} not found.`);
  }
  return {
    sourceType: "CILT",
    packageType: normalizePackageType(record.packageType),
    record,
  };
};

const buildV2SheetFromRecord = ({
  packageType,
  sourceType,
  record,
  headerMeta = {},
}) => {
  const supportedPackageType = normalizePackageType(packageType);
  if (!V2_SUPPORTED_PACKAGE_TYPES.has(supportedPackageType)) {
    return null;
  }

  const pageSize = supportedPackageType === "CHECKLIST CILT" ? "A4 landscape" : "A4 portrait";
  const reportTitle = supportedPackageType;
  const meta = resolveV2HeaderMeta(supportedPackageType, headerMeta);
  const inspectionRows =
    supportedPackageType === "CHECKLIST CILT"
      ? parseJsonArray(record?.inspectionData)
      : parseJsonArray(record?.steps || record?.stepsData);
  const submittedBy = resolveSubmittedBy({ record, inspectionRows });
  const headerHtml = renderV2ReportHeader({
    title: reportTitle,
    pageSize,
    headerMeta: meta,
  });
  const generalInfoHtml = renderV2GeneralInfoTable({
    record,
    submittedBy,
    packageType: supportedPackageType,
  });
  const detailHtml =
    supportedPackageType === "CHECKLIST CILT"
      ? renderChecklistTableHtml(inspectionRows)
      : renderCipContentHtml(record);

  const processOrder =
    sourceType === "CIP"
      ? toDisplayText(record?.processOrder || record?.process_order)
      : toDisplayText(record?.processOrder);

  return {
    pageSize,
    html: `
      <section class="cilt-print-sheet" data-page-size="${escapeHtml(pageSize)}">
        ${headerHtml}
        <div class="report-info">
          <p class="report-process-order"><strong>Process Order:</strong> ${escapeHtml(processOrder)}</p>
          ${generalInfoHtml}
        </div>
        ${detailHtml}
      </section>
    `,
  };
};

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
  renderMode: job.renderMode || DEFAULT_RENDER_MODE,
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

const formatMs = (value) => `${Math.max(0, Math.round(Number(value) || 0))}ms`;
const withStageError = (stage, error) => {
  const wrapped = new Error(`[stage:${stage}] ${compactErrorMessage(error)}`);
  wrapped.stage = stage;
  return wrapped;
};

const normalizePathname = (urlValue) => {
  try {
    const parsed = new URL(String(urlValue || "").trim());
    return parsed.pathname.replace(/\/+$/g, "");
  } catch (error) {
    return "";
  }
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
      if (/class=["'][^"']*cilt-print-sheet[^"']*["']/i.test(rawHtml)) {
        return rawHtml;
      }
      return `<section class="cilt-print-sheet" data-page-size="${sizeKey}" style="page:${pageName};">${rawHtml}</section>`;
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
  try {
    await page.pdf({
      path: outputPath,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      timeout: JOB_TIMEOUT_MS,
    });
  } catch (error) {
    throw withStageError("fallback-generate-pdf", error);
  }
  const pdfDoneAt = Date.now();
  return {
    mode: "inline-fallback",
    gotoMs: gotoDoneAt - startedAt,
    readyMs: readyDoneAt - gotoDoneAt,
    fontsMs: fontsDoneAt - readyDoneAt,
    pdfMs: pdfDoneAt - fontsDoneAt,
    totalMs: pdfDoneAt - startedAt,
  };
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
        timeout: PRINT_READY_TIMEOUT_MS,
      });
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
        `Print route render failed${routeError ? `: ${routeError.trim()}` : "."}`
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

    try {
      await page.pdf({
        path: outputPath,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        timeout: JOB_TIMEOUT_MS,
      });
    } catch (error) {
      throw withStageError("generate-pdf", error);
    }
    const pdfDoneAt = Date.now();
    return {
      mode: "print-route",
      gotoMs: gotoDoneAt - startedAt,
      readyMs: readyDoneAt - gotoDoneAt,
      fontsMs: fontsDoneAt - readyDoneAt,
      pdfMs: pdfDoneAt - fontsDoneAt,
      totalMs: pdfDoneAt - startedAt,
    };
  } catch (error) {
    if (!isRouteRecoverableError(error)) throw error;
    // eslint-disable-next-line no-console
    console.warn(
      `[CILT PDF] Print route failed, fallback to inline chunk render: ${compactErrorMessage(
        error
      )}`
    );
    return renderInlineChunkToPdf({
      page,
      sheets,
      extraStyles,
      outputPath,
    });
  }
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

  let context = null;
  let hasActiveContext = false;
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

    const browser = await getSharedBrowser(chromium);
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    activeRenderContexts += 1;
    hasActiveContext = true;
    const page = await context.newPage();

    const chunkSize = Math.max(
      1,
      Math.min(Number(job.chunkSize) || MAX_SHEETS_PER_CHUNK, MAX_SHEETS_PER_CHUNK)
    );
    const renderMode = normalizeRenderMode(job.renderMode);
    const sheetChunks = splitIntoChunks(job.sheets, chunkSize);
    job.chunkSize = chunkSize;
    job.renderMode = renderMode;
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

      job.processedChunks = chunkNumber;
      const progressEnd = 12 + Math.round((chunkNumber / sheetChunks.length) * 68);
      job.progress = Math.max(job.progress, progressEnd);
      const timingSummary = `mode=${chunkTiming.mode}, nav=${formatMs(chunkTiming.gotoMs)}, ready=${formatMs(
        chunkTiming.readyMs
      )}, font=${formatMs(chunkTiming.fontsMs)}, pdf=${formatMs(
        chunkTiming.pdfMs
      )}, total=${formatMs(chunkTiming.totalMs)}`;
      job.message =
        sheetChunks.length > 1
          ? `Chunk ${chunkNumber}/${sheetChunks.length} completed (${timingSummary}).`
          : `PDF pages rendered (${timingSummary}).`;
      // eslint-disable-next-line no-console
      console.log(
        `Chunk ${chunkNumber}/${sheetChunks.length} (${chunkSheets.length} sheets): ${timingSummary}`
      );
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
        `CILTpro PDF failed (${jobId}): ${job.error} | raw=${compactErrorMessage(
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
    if (hasActiveContext) {
      activeRenderContexts = Math.max(0, activeRenderContexts - 1);
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

const createJob = ({
  fileName,
  sheets,
  extraStyles = "",
  requestedBy,
  chunkSize,
  printBaseUrl,
  renderMode,
}) => {
  const validationError = validateSheetsPayload(sheets);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const jobId = createJobId();
  const resolvedChunkSize = normalizeChunkSize(chunkSize);
  const requestedRenderMode = normalizeRenderMode(renderMode);
  const resolvedRenderMode = LOCKED_RENDER_MODE || requestedRenderMode;
  const sanitizedSheets = sanitizeSheets(sheets);
  const resolvedPrintBaseUrl =
    normalizePrintBaseUrl(printBaseUrl) || normalizePrintBaseUrl(PRINT_BASE_URL);
  const job = {
    jobId,
    printToken: createJobToken(),
    status: "queued",
    progress: 0,
    message: "Job queued.",
    cancelRequested: false,
    fileName: sanitizeFileName(fileName, `cilt-export-${jobId}.pdf`),
    requestedBy: String(requestedBy || "").trim() || "unknown",
    renderMode: resolvedRenderMode,
    printBaseUrl: resolvedPrintBaseUrl,
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

  // eslint-disable-next-line no-console
  console.log(
    `[CILT PDF] Job created ${jobId}: totalSheets=${sanitizedSheets.length}, requestedChunkSize=${String(
      chunkSize
    )}, resolvedChunkSize=${resolvedChunkSize}, requestedRenderMode=${requestedRenderMode}, resolvedRenderMode=${resolvedRenderMode}, lockRenderMode=${LOCKED_RENDER_MODE || "-"}, printBase=${
      resolvedPrintBaseUrl || PRINT_BASE_URL
    }`
  );

  jobs.set(jobId, job);
  setImmediate(() => runJob(jobId));
  return toPublicJob(job);
};

const createJobFromItems = async ({
  fileName,
  items,
  extraStyles = "",
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

  const sheets = [];
  const unsupportedPackages = new Set();

  try {
    for (const item of normalizedItems) {
      const loaded = await fetchV2RecordByItem(item);
      if (!V2_SUPPORTED_PACKAGE_TYPES.has(loaded.packageType)) {
        unsupportedPackages.add(loaded.packageType || "UNKNOWN");
        continue;
      }

      const sheet = buildV2SheetFromRecord({
        packageType: loaded.packageType,
        sourceType: loaded.sourceType,
        record: loaded.record,
        headerMeta: item.headerMeta,
      });
      if (sheet) sheets.push(sheet);
    }
  } catch (error) {
    const wrapped = new Error(
      `Failed to prepare server-side PDF sheets: ${compactErrorMessage(error)}`
    );
    wrapped.statusCode =
      Number(error?.statusCode) ||
      (String(error?.message || "").toLowerCase().includes("not found") ? 404 : 500);
    throw wrapped;
  }

  if (unsupportedPackages.size > 0) {
    const error = new Error(
      `Unsupported package type(s) for /v2: ${Array.from(unsupportedPackages).join(
        ", "
      )}. Supported: ${Array.from(V2_SUPPORTED_PACKAGE_TYPES).join(", ")}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (sheets.length === 0) {
    const error = new Error("No printable sheets were generated from requested items.");
    error.statusCode = 400;
    throw error;
  }

  const mergedExtraStyles = `${V2_RENDERER_STYLES}\n${String(extraStyles || "")}`;
  return createJob({
    fileName,
    sheets,
    extraStyles: mergedExtraStyles,
    requestedBy,
    chunkSize,
    printBaseUrl,
    renderMode,
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
  createJob,
  createJobFromItems,
  getJob,
  getJobInternal,
  getJobPrintPayload,
  cancelJob,
  removeJob,
  ensureCleanupLoop,
};
