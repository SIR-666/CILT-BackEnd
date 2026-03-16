const fs = require("fs");
const path = require("path");

const V2_HEADER_META_DEFAULTS = {};

const V2_PACKAGE_PAGE_SIZE_MAP = {
  SEGREGASI: "A4 landscape",
  "PEMAKAIAN SCREW CAP": "A4 landscape",
  "PEMAKAIAN PAPER": "A4 landscape",
  "PENGECEKAN H2O2 ( SPRAY )": "A4 landscape",
  "PERFORMA RED AND GREEN": "A4 landscape",
  "CHECKLIST CILT": "A4 landscape",
  "A3 / FLEX": "A3 landscape",
  "PAPER A3": "A3 landscape",
  "PEMAKAIAN H2O2 A3": "A3 landscape",
  "PENGECEKAN PRESSURE": "A3 landscape",
  "START & FINISH": "A3 landscape",
  "INFORMASI PRODUK": "A3 landscape",
  "LAPORAN PRODUKSI MESIN": "A3 landscape",
  "LAPORAN ARTEMA & SMS CARDBOARD": "A4 landscape",
  "LAPORAN FRANS WP 25 CASE": "A4 landscape",
  "ROBOT PALLETIZER FILLER": "A4 landscape",
};

const V2_HEADER_LOGO_SRC = (() => {
  const envLogoSrc = String(process.env.CILT_PDF_HEADER_LOGO_SRC || "").trim();
  if (envLogoSrc) return envLogoSrc;

  const bundledLogoPath = path.join(__dirname, "assets", "GreenfieldsLogo_Green.png");
  try {
    const logoBuffer = fs.readFileSync(bundledLogoPath);
    if (logoBuffer.length > 0) {
      return `data:image/png;base64,${logoBuffer.toString("base64")}`;
    }
  } catch (error) {
    return "";
  }
  return "";
})();

const V2_RENDERER_STYLES = `
  :root {
    --v2-color-text: #111827;
    --v2-color-text-muted: #6b7280;
    --v2-color-border: #000;
    --v2-color-border-soft: #e5e7eb;
    --v2-color-header-bg: #f2f2f2;
    --v2-color-section-bg: #d9f0e3;
    --v2-color-section-text: #2f5d43;
    --v2-color-paper: #fff;
  }
  .header-container {
    --rh-logo-col: 24%;
    --rh-company-col: 54%;
    --rh-meta-col: 22%;
    --rh-title-label-col: 24%;
    --rh-title-content-col: 54%;
    --rh-title-meta-col: 22%;
    border: 1px solid var(--v2-color-border-soft);
    border-radius: 8px;
    background: var(--v2-color-paper);
    margin-bottom: 14px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .cilt-report-header--a4-portrait {
    --rh-logo-col: 24%;
    --rh-company-col: 54%;
    --rh-meta-col: 22%;
    --rh-title-label-col: 24%;
    --rh-title-content-col: 54%;
    --rh-title-meta-col: 22%;
  }
  .cilt-report-header--a4-landscape {
    --rh-logo-col: 19%;
    --rh-company-col: 61%;
    --rh-meta-col: 20%;
    --rh-title-label-col: 19%;
    --rh-title-content-col: 61%;
    --rh-title-meta-col: 20%;
  }
  .cilt-report-header--a3-portrait {
    --rh-logo-col: 22%;
    --rh-company-col: 56%;
    --rh-meta-col: 22%;
    --rh-title-label-col: 22%;
    --rh-title-content-col: 56%;
    --rh-title-meta-col: 22%;
  }
  .cilt-report-header--a3-landscape {
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
  .header-main-table td,
  .header-title-table td {
    padding: 0;
  }
  .logo-section {
    width: var(--rh-logo-col);
    min-width: 92px;
    text-align: center;
    vertical-align: middle;
    padding: 8px;
  }
  .greenfields-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 50px;
  }
  .greenfields-logo-img {
    display: block;
    max-width: 118px;
    max-height: 38px;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  .logo-fallback {
    font-weight: bold;
    font-size: 18px;
    color: var(--v2-color-section-text);
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
    font-weight: bold;
    color: var(--v2-color-text);
    text-align: center;
  }
  .meta-section {
    width: var(--rh-meta-col);
    min-width: 120px;
    vertical-align: middle;
    padding: 8px 10px;
    border-left: 1px solid var(--v2-color-border-soft);
  }
  .meta-info-table td {
    padding: 2px 0;
    font-size: 11px;
    line-height: 1.2;
    vertical-align: top;
  }
  .meta-label {
    width: 52px;
    color: var(--v2-color-text);
    font-weight: 600;
    white-space: nowrap;
  }
  .meta-colon {
    width: 8px;
    text-align: center;
    color: var(--v2-color-text);
  }
  .meta-value {
    font-weight: 600;
    color: var(--v2-color-text);
  }
  .header-title-table {
    border-top: 1px solid var(--v2-color-border-soft);
  }
  .title-label {
    width: var(--rh-title-label-col);
    min-width: 92px;
    padding: 6px 8px;
    text-align: center;
    font-weight: 600;
    font-size: 11px;
    color: var(--v2-color-text);
    background: var(--v2-color-header-bg);
    border-right: 1px solid var(--v2-color-border-soft);
  }
  .title-content {
    width: var(--rh-title-content-col);
    padding: 6px 12px;
    text-align: center;
    font-weight: bold;
    font-size: 12px;
    line-height: 1.3;
    color: var(--v2-color-text);
  }
  .title-meta-spacer {
    width: var(--rh-title-meta-col);
    min-width: 120px;
    border-left: 1px solid var(--v2-color-border-soft);
    background: var(--v2-color-header-bg);
  }
  .report-info {
    margin-bottom: 14px;
  }
  .report-process-order {
    margin: 0 0 6px;
    font-size: 11px;
    color: var(--v2-color-text);
  }
  .general-info-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .general-info-table td {
    border: 1px solid var(--v2-color-border);
    padding: 5px 7px;
    font-size: 10.5px;
    color: var(--v2-color-text);
    vertical-align: top;
  }
  .section-title {
    font-weight: 700;
    background-color: var(--v2-color-section-bg);
    padding: 8px 10px;
    margin: 15px 0 8px;
    font-size: 12px;
    color: var(--v2-color-section-text);
  }
  .v2-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
  }
  .v2-table th,
  .v2-table td {
    border: 1px solid var(--v2-color-border);
    padding: 5px 6px;
    vertical-align: top;
  }
  .v2-table th {
    background: var(--v2-color-header-bg);
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
    color: transparent;
    font-style: normal;
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

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeColspan = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
};

const renderV2EmptyRow = ({ colspan = 1, cellClass = "center v2-empty" } = {}) =>
  `<tr><td class="${cellClass}" colspan="${normalizeColspan(colspan)}"></td></tr>`;

const renderV2EmptyBlock = ({
  borderColor = "var(--v2-color-border,#000)",
  padding = "10px",
} = {}) =>
  `<div class="v2-empty" style="border:1px solid ${borderColor}; padding:${String(
    padding || "10px"
  )};"></div>`;

const normalizeDisplayFallback = (fallback = "") => {
  const normalized = String(fallback ?? "").trim();
  if (!normalized) return "";
  const lowered = normalized.toLowerCase();
  if (["-", "--", "n/a", "na", "null", "undefined"].includes(lowered)) return "";
  return normalized;
};

const toDisplayText = (value, fallback = "") => {
  const safeFallback = normalizeDisplayFallback(fallback);
  if (value === null || value === undefined) return safeFallback;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return safeFallback;
    if (["-", "--", "n/a", "na", "null", "undefined"].includes(trimmed.toLowerCase())) {
      return safeFallback;
    }
    return trimmed;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : safeFallback;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
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

const normalizeSourceType = (value) => (String(value ?? "") === "CIP" ? "CIP" : "CILT");
const normalizePackageType = (value) => String(value ?? "");

const isMeaningfulSubmitterText = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return !["-", "null", "undefined", "n/a", "na"].includes(normalized);
};

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
  return "";
};

const formatDateTimeForPrint = (value) => {
  if (!value) return "";
  const parsed = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mm = String(parsed.getMinutes()).padStart(2, "0");
  const ss = String(parsed.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hh}:${mm}:${ss}`;
};

const resolveV2HeaderMeta = (packageType, extraMeta = {}) => {
  const defaults = V2_HEADER_META_DEFAULTS[packageType] || {
    frm: "",
    rev: "",
    berlaku: "",
    hal: "",
  };
  return {
    frm: toDisplayText(extraMeta?.frm ?? defaults.frm, ""),
    rev: toDisplayText(extraMeta?.rev ?? defaults.rev, ""),
    berlaku: toDisplayText(extraMeta?.berlaku ?? defaults.berlaku, ""),
    hal: toDisplayText(extraMeta?.hal ?? defaults.hal, ""),
  };
};

const getHeaderPageClass = (pageSize, normalizePageSize) => {
  const normalized =
    typeof normalizePageSize === "function" ? normalizePageSize(pageSize) : pageSize;
  if (normalized === "A4 landscape") return "cilt-report-header--a4-landscape";
  if (normalized === "A3 landscape") return "cilt-report-header--a3-landscape";
  if (normalized === "A3 portrait") return "cilt-report-header--a3-portrait";
  return "cilt-report-header--a4-portrait";
};

const renderV2ReportHeader = ({ title, pageSize, headerMeta, normalizePageSize }) => {
  const pageClass = getHeaderPageClass(pageSize, normalizePageSize);
  const normalizedPageSize =
    typeof normalizePageSize === "function" ? normalizePageSize(pageSize) : pageSize;
  const logoHtml = V2_HEADER_LOGO_SRC
    ? `<img class="greenfields-logo-img" src="${escapeHtml(
        V2_HEADER_LOGO_SRC
      )}" alt="Greenfields" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';" /><span class="logo-fallback" style="display:none;">Greenfields</span>`
    : '<span class="logo-fallback">Greenfields</span>';
  return `
    <div class="header-container ${escapeHtml(pageClass)}" data-report-page-size="${escapeHtml(
      normalizedPageSize
    )}">
      <table class="header-main-table">
        <tr>
          <td class="logo-section">
            <div class="greenfields-logo">
              ${logoHtml}
            </div>
          </td>
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
          <td class="title-content">${escapeHtml(toDisplayText(title, ""))}</td>
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
        <td><strong>Product:</strong> ${escapeHtml(
          toDisplayText(record?.product ?? record?.cipType, "")
        )}</td>
      </tr>
      <tr>
        <td><strong>Plant:</strong> ${escapeHtml(toDisplayText(record?.plant, ""))}</td>
        <td><strong>Line:</strong> ${escapeHtml(toDisplayText(record?.line, ""))}</td>
      </tr>
      <tr>
        <td><strong>Machine:</strong> ${escapeHtml(
          toDisplayText(record?.machine ?? record?.posisi, "")
        )}</td>
        <td><strong>Shift:</strong> ${escapeHtml(toDisplayText(record?.shift, ""))}</td>
      </tr>
      <tr>
        <td><strong>Submitted By:</strong> ${escapeHtml(toDisplayText(submittedBy, ""))}</td>
        <td><strong>Package:</strong> ${escapeHtml(toDisplayText(packageType, ""))}</td>
      </tr>
    </tbody>
  </table>
`;

const resolveV2PageSizeByPackageType = (packageType = "") =>
  V2_PACKAGE_PAGE_SIZE_MAP[normalizePackageType(packageType)] || "A4 portrait";

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
      headerMeta:
        rawItem?.headerMeta && typeof rawItem.headerMeta === "object"
          ? rawItem.headerMeta
          : {},
    });
  }
  return deduped;
};

const isCipItemDescriptor = (item = {}) =>
  normalizeSourceType(item?.sourceType) === "CIP" ||
  normalizePackageType(item?.packageType) === "REPORT CIP";

module.exports = {
  V2_HEADER_META_DEFAULTS,
  V2_PACKAGE_PAGE_SIZE_MAP,
  V2_RENDERER_STYLES,
  escapeHtml,
  renderV2EmptyRow,
  renderV2EmptyBlock,
  toDisplayText,
  parseJsonArray,
  normalizeSourceType,
  normalizePackageType,
  resolveSubmittedBy,
  resolveV2HeaderMeta,
  renderV2ReportHeader,
  renderV2GeneralInfoTable,
  resolveV2PageSizeByPackageType,
  dedupeV2Items,
  isCipItemDescriptor,
};
