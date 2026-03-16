const { escapeHtml, renderV2EmptyBlock, toDisplayText } = require("./rendererShared");

const V2_FALLBACK_DETAIL_IGNORE_KEYS = new Set([
  "id",
  "done",
  "saved",
  "savedAt",
  "createdAt",
  "updatedAt",
  "formOpenTime",
  "submitTime",
  "timestamp",
  "_anchorDate",
  "page",
]);

const formatFallbackCellValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value) || typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      return serialized.length > 180 ? `${serialized.slice(0, 177)}...` : serialized;
    } catch (error) {
      return String(value);
    }
  }
  return String(value);
};

const normalizeFallbackInspectionRows = (inspectionData) => {
  const parsed = (() => {
    if (Array.isArray(inspectionData)) return inspectionData;
    if (typeof inspectionData === "string") {
      const trimmed = inspectionData.trim();
      if (!trimmed) return [];
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        return [];
      }
    }
    if (inspectionData && typeof inspectionData === "object") return [inspectionData];
    return [];
  })();

  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => {
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => {
        if (V2_FALLBACK_DETAIL_IGNORE_KEYS.has(String(key))) return;
        normalized[String(key)] = formatFallbackCellValue(value);
      });
      return normalized;
    });
};

const toTitleLabel = (key) =>
  String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const renderFallbackInspectionTableHtml = (rows = []) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return renderV2EmptyBlock();
  }

  const columns = [];
  const seen = new Set();
  for (const row of safeRows) {
    Object.keys(row || {}).forEach((key) => {
      const normalizedKey = String(key).trim();
      if (!normalizedKey || seen.has(normalizedKey)) return;
      seen.add(normalizedKey);
      columns.push(normalizedKey);
    });
    if (columns.length >= 10) break;
  }

  if (columns.length === 0) {
    return renderV2EmptyBlock();
  }

  const headers = columns
    .map((key) => `<th style="text-align:left;">${escapeHtml(toTitleLabel(key))}</th>`)
    .join("");

  const bodyRows = safeRows
    .map((row, index) => {
      const cells = columns
        .map((key) => `<td class="left">${escapeHtml(toDisplayText(row?.[key], ""))}</td>`)
        .join("");
      return `<tr><td class="center">${index + 1}</td>${cells}</tr>`;
    })
    .join("");

  return `
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:52px;">No</th>
          ${headers}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  `;
};

const renderFallbackCiltContentHtml = (record = {}, packageType = "") => {
  const rows = normalizeFallbackInspectionRows(record?.inspectionData);
  const infoRows = [
    { label: "Remarks", value: toDisplayText(record?.remarks, "") },
    { label: "Data 1", value: toDisplayText(record?.data1, "") },
    { label: "Data 2", value: toDisplayText(record?.data2, "") },
  ].filter((row) => String(row.value || "").trim() !== "");

  const infoTable =
    infoRows.length > 0
      ? `
      <table class="v2-table" style="margin-bottom:8px;">
        <tbody>
          ${infoRows
            .map(
              (row) => `
              <tr>
                <td style="width:160px; font-weight:700; background:#f3f4f6;">${escapeHtml(row.label)}</td>
                <td>${escapeHtml(row.value)}</td>
              </tr>
            `
            )
            .join("")}
        </tbody>
      </table>
    `
      : "";

  return `
    <p class="cip-section-title">${escapeHtml(
      toDisplayText(packageType, "")
    )}</p>
    ${infoTable}
    ${renderFallbackInspectionTableHtml(rows)}
  `;
};

module.exports = { renderFallbackCiltContentHtml };
