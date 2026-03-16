const {
  escapeHtml,
  parseJsonArray,
  renderV2EmptyBlock,
  toDisplayText,
} = require("./rendererShared");

const PERFORMA_RESERVED_KEYS = new Set([
  "activity",
  "job_type",
  "jobType",
  "type",
  "name",
  "good",
  "need",
  "reject",
  "g",
  "n",
  "r",
  "results",
  "createdAt",
  "updatedAt",
  "submittedBy",
  "submitBy",
  "user",
  "time",
]);

const normalizeHour = (raw) => {
  const text = String(raw ?? "").trim().toLowerCase();
  if (!text) return null;

  const direct = text.match(/^(\d{1,2})(?::\d{2})?$/);
  if (direct) {
    const hour = Number(direct[1]);
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      return String(hour).padStart(2, "0");
    }
  }

  const prefixed = text.match(/^(?:h|hour)[_:\-\s]?(\d{1,2})$/);
  if (prefixed) {
    const hour = Number(prefixed[1]);
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) {
      return String(hour).padStart(2, "0");
    }
  }

  return null;
};

const toFiniteNumberText = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return String(parsed);
};

const parseCombinedInspectionRows = (value) => {
  const raw = String(value || "");
  if (!raw) return [];
  const chunks = raw.match(/\[[\s\S]*?\]/g) || [];
  const rows = [];

  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);
      if (Array.isArray(parsed)) rows.push(...parsed);
    } catch (error) {
      // Ignore malformed chunks.
    }
  }

  return rows;
};

const collectResultsByHour = (row = {}) => {
  const byHour = {};
  const directResults =
    row?.results && typeof row.results === "object" && !Array.isArray(row.results)
      ? row.results
      : {};

  for (const [key, value] of Object.entries(directResults)) {
    const hour = normalizeHour(key);
    if (!hour) continue;
    const text = String(value ?? "").trim();
    if (!text) continue;
    byHour[hour] = text;
  }

  for (const [key, value] of Object.entries(row || {})) {
    if (PERFORMA_RESERVED_KEYS.has(String(key))) continue;
    const hour = normalizeHour(key);
    if (!hour) continue;
    const text = String(value ?? "").trim();
    if (!text) continue;
    byHour[hour] = text;
  }

  return byHour;
};

const normalizePerformaRows = (record = {}, inspectionRows = null) => {
  const baseRows = Array.isArray(inspectionRows)
    ? inspectionRows
    : parseJsonArray(record?.inspectionData);
  const combinedRows = parseCombinedInspectionRows(record?.CombinedInspectionData);
  const mergedRows = [...baseRows, ...combinedRows];

  return mergedRows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      activity: toDisplayText(
        row?.activity || row?.job_type || row?.jobType || row?.type || row?.name
      ),
      good: toFiniteNumberText(row?.good ?? row?.g),
      need: toFiniteNumberText(row?.need ?? row?.n),
      reject: toFiniteNumberText(row?.reject ?? row?.r),
      resultsByHour: collectResultsByHour(row),
    }))
    .filter((row) => String(row.activity || "").trim() !== "");
};

const collectHourColumns = (rows = []) => {
  const found = new Set();
  rows.forEach((row) => {
    Object.keys(row?.resultsByHour || {}).forEach((hour) => found.add(hour));
  });

  return Array.from(found).sort((left, right) => Number(left) - Number(right));
};

const resolveResultCellStyle = (value, good, reject) => {
  const parseNumeric = (raw) => {
    const text = String(raw ?? "").trim();
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parsed = parseNumeric(value);
  const parsedGood = parseNumeric(good);
  const parsedReject = parseNumeric(reject);
  if (parsed === null) return "";
  if (parsedGood !== null && parsed === parsedGood) {
    return "background:#dcfce7;color:#166534;font-weight:700;";
  }
  if (parsedReject !== null && parsed === parsedReject) {
    return "background:#fee2e2;color:#991b1b;font-weight:700;";
  }
  return "background:#fef3c7;color:#92400e;font-weight:700;";
};

const renderPerformaRedGreenDetailHtml = (record = {}, inspectionRows = null) => {
  const rows = normalizePerformaRows(record, inspectionRows);
  const hourColumns = collectHourColumns(rows);

  if (rows.length === 0) {
    return renderV2EmptyBlock();
  }

  const hourHeaders = hourColumns
    .map((hour) => `<th style="width:60px;">${escapeHtml(hour)}:00</th>`)
    .join("");

  const bodyRows = rows
    .map((row, index) => {
      const resultCells = hourColumns
        .map((hour) => {
          const value = toDisplayText(row?.resultsByHour?.[hour], "");
          return `<td class="center" style="${resolveResultCellStyle(
            value,
            row?.good,
            row?.reject
          )}">${escapeHtml(value)}</td>`;
        })
        .join("");

      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="left">${escapeHtml(row.activity)}</td>
          <td class="center">${escapeHtml(row.good)}</td>
          <td class="center">${escapeHtml(row.need)}</td>
          <td class="center">${escapeHtml(row.reject)}</td>
          ${resultCells}
        </tr>
      `;
    })
    .join("");

  return `
    <p class="section-title">PERFORMA RED AND GREEN</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:42px;">No</th>
          <th style="text-align:left;">Activity</th>
          <th style="width:58px;">G</th>
          <th style="width:58px;">N</th>
          <th style="width:58px;">R</th>
          ${hourHeaders}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
};

module.exports = { renderPerformaRedGreenDetailHtml };
