const { escapeHtml, resolveSubmittedBy, toDisplayText } = require("./rendererShared");
const {
  getValueByExactKey,
  normalizeText,
  normalizeToken,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const DEFAULT_PENAMBAHAN_ROWS = 5;
const DEFAULT_MCCP_ROWS = 5;
const OLEH_COLUMN_WIDTH = 200;
const PERSIAPAN_BLOCK_WIDTH = 340;

const FALLBACK_PERSIAPAN_COLUMNS = [
  { field: "type_h2o2", label: "Type H2O2", section: "persiapan", order_no: 1, unit: "" },
  { field: "jam_persiapan", label: "Jam Persiapan", section: "persiapan", order_no: 2, unit: "WIB" },
  { field: "h2o2_liter", label: "H2O2 Liter", section: "persiapan", order_no: 3, unit: "LTR" },
];

const FALLBACK_PENAMBAHAN_COLUMNS = [
  { field: "volume", label: "Volume", section: "penambahan", order_no: 101, unit: "" },
  { field: "jam_penambahan", label: "Jam Penambahan", section: "penambahan", order_no: 102, unit: "" },
];

const FALLBACK_MCCP_COLUMNS = [
  { field: "jam_mccp", label: "Jam MCCP", section: "mccp", order_no: 201, unit: "" },
  { field: "persen", label: "%", section: "mccp", order_no: 202, unit: "%" },
];

const FALLBACK_CHECK_COLUMNS = [
  { field: "kondisi_inductor", label: "Kondisi Inductor", section: "check", order_no: 301, unit: "" },
  { field: "kondisi_dolly", label: "Kondisi Dolly", section: "check", order_no: 302, unit: "" },
];

const H2O2_META_TOKENS = new Set([
  "penambahanrows",
  "penambahan",
  "mccprows",
  "mccp",
  "mastercolumns",
  "createdby",
  "user",
  "_user",
  "time",
  "_time",
  "h2o2a3",
]);

const isMetaField = (field) => H2O2_META_TOKENS.has(normalizeToken(field));

const isSplitCheckField = (columnOrField) => {
  const source =
    typeof columnOrField === "string"
      ? columnOrField
      : columnOrField?.field || columnOrField?.label;
  const token = normalizeToken(source);
  return token === "kondisiinductor" || token === "kondisidolly";
};

const trimSplitCheckPart = (value) =>
  normalizeText(value).replace(/^[\s|,;/-]+|[\s|,;/-]+$/g, "").trim();

const parseSplitCheckValue = (value) => {
  const text = normalizeText(value).replace(/\r?\n/g, " ").trim();
  if (!text) return { left: "", right: "" };

  const upper = text.toUpperCase();
  const leftIndex = upper.indexOf("L:");
  const rightIndex = upper.indexOf("R:");

  if (leftIndex === -1 && rightIndex === -1) {
    return { left: text, right: "" };
  }

  if (leftIndex !== -1 && (rightIndex === -1 || leftIndex < rightIndex)) {
    return {
      left: trimSplitCheckPart(text.slice(leftIndex + 2, rightIndex === -1 ? undefined : rightIndex)),
      right: rightIndex === -1 ? "" : trimSplitCheckPart(text.slice(rightIndex + 2)),
    };
  }

  return {
    left: leftIndex === -1 ? "" : trimSplitCheckPart(text.slice(leftIndex + 2)),
    right: trimSplitCheckPart(text.slice(rightIndex + 2, leftIndex === -1 ? undefined : leftIndex)),
  };
};

const isSectionMatch = (sectionValue, targetSection) => {
  const left = normalizeToken(sectionValue);
  const right = normalizeToken(targetSection);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
};

const sectionColumns = (columns = [], section) =>
  columns.filter((column) => isSectionMatch(column.section, section));

const normalizeMasterColumns = (columns = []) =>
  (Array.isArray(columns) ? columns : [])
    .map((column, index) => {
      const field = normalizeText(column?.field ?? column?.key ?? column?.name).trim();
      if (!field) return null;
      const orderNo = Number(column?.order_no ?? column?.order);
      return {
        field,
        label: normalizeText(column?.label || field).trim(),
        section: normalizeText(column?.section).toLowerCase().trim(),
        order_no: Number.isFinite(orderNo) ? orderNo : index + 1,
        unit: normalizeText(column?.unit).trim(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order_no - b.order_no);

const inferSectionByField = (field) => {
  const token = normalizeToken(field);
  if (token.includes("kondisi")) return "check";
  if (token.includes("penambahan") || token.includes("volume")) return "penambahan";
  if (token.includes("mccp") || token.includes("persen")) return "mccp";
  return "persiapan";
};

const inferColumnsFromPayload = (payload = {}) => {
  const mainColumns = Object.keys(payload || {})
    .filter((key) => !isMetaField(key))
    .map((key, index) => ({
      field: key,
      label: key
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      section: inferSectionByField(key),
      order_no: index + 1,
      unit: normalizeToken(key).includes("liter")
        ? "LTR"
        : normalizeToken(key).includes("persen")
        ? "%"
        : normalizeToken(key).includes("jam")
        ? "WIB"
        : "",
    }));

  const penambahanRows =
    payload?.penambahan_rows ?? payload?.penambahanRows ?? payload?.penambahan ?? [];
  const firstPenambahan =
    Array.isArray(penambahanRows) && penambahanRows.length > 0 ? penambahanRows[0] : {};
  const penambahanColumns = Object.keys(firstPenambahan || {})
    .filter((key) => !["oleh", "id"].includes(normalizeToken(key)))
    .map((key, index) => ({
      field: key,
      label: key
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      section: "penambahan",
      order_no: 100 + index,
      unit: "",
    }));

  const mccpRows = payload?.mccp_rows ?? payload?.mccpRows ?? payload?.mccp ?? [];
  const firstMccp = Array.isArray(mccpRows) && mccpRows.length > 0 ? mccpRows[0] : {};
  const mccpColumns = Object.keys(firstMccp || {})
    .filter((key) => !["oleh", "id"].includes(normalizeToken(key)))
    .map((key, index) => ({
      field: key,
      label: key
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      section: "mccp",
      order_no: 200 + index,
      unit: normalizeToken(key).includes("persen") ? "%" : "",
    }));

  return normalizeMasterColumns([...mainColumns, ...penambahanColumns, ...mccpColumns]);
};

const buildRowByColumns = (row = {}, columns = []) => {
  const next = {};
  columns.forEach((column) => {
    next[column.field] = normalizeText(getValueByExactKey(row, column.field));
  });
  next.oleh = normalizeText(getValueByExactKey(row, "oleh"));
  return next;
};

const normalizeRowsByColumns = (rows = [], columns = [], minRows = 1) => {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const next = sourceRows.map((row) => buildRowByColumns(row, columns));
  while (next.length < minRows) {
    next.push(buildRowByColumns({}, columns));
  }
  return next;
};

const countMainValues = (payload = {}) =>
  Object.entries(payload || {}).reduce((total, [key, value]) => {
    if (isMetaField(key)) return total;
    return total + (normalizeText(value).trim() !== "" ? 1 : 0);
  }, 0);

const countRowValues = (rows = []) =>
  (Array.isArray(rows) ? rows : []).reduce((total, row) => {
    const rowCount = Object.entries(row || {}).reduce((count, [key, value]) => {
      if (["id", "oleh"].includes(normalizeToken(key))) return count;
      return count + (normalizeText(value).trim() !== "" ? 1 : 0);
    }, 0);
    return total + rowCount;
  }, 0);

const scorePayload = (payload = {}) => {
  if (!payload || typeof payload !== "object") return -1;
  const hasMasterColumns =
    Array.isArray(payload?.master_columns) && payload.master_columns.length > 0;
  const penambahanRows = payload?.penambahan_rows ?? payload?.penambahanRows ?? payload?.penambahan;
  const mccpRows = payload?.mccp_rows ?? payload?.mccpRows ?? payload?.mccp;
  return (
    (hasMasterColumns ? 1000 : 0) +
    countMainValues(payload) +
    countRowValues(penambahanRows) +
    countRowValues(mccpRows)
  );
};

const pickBestPayload = (inspectionRows = []) => {
  const candidates = (Array.isArray(inspectionRows) ? inspectionRows : [])
    .map((row) => row?.h2o2_a3 ?? row?.h2o2A3 ?? row)
    .filter((candidate) => candidate && typeof candidate === "object");

  if (candidates.length === 0) return {};

  let best = candidates[0];
  let bestScore = scorePayload(best);

  candidates.forEach((candidate) => {
    const score = scorePayload(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  });

  return best || {};
};

const rowFilled = (row = {}, columns = []) =>
  columns.some((column) => normalizeText(row?.[column.field]).trim() !== "");

const toDisplayRows = (rows = [], columns = [], minRows = 5) => {
  const filledCount = (Array.isArray(rows) ? rows : []).filter((row) => rowFilled(row, columns)).length;
  const total = Math.max(minRows, filledCount);
  const output = [];

  for (let index = 0; index < total; index += 1) {
    output.push(rows[index] || buildRowByColumns({}, columns));
  }
  return output;
};

const toColumnWidth = (column = {}) => {
  const token = normalizeToken(column?.field || column?.label);
  if (token.includes("jam")) return 90;
  if (token.includes("persen")) return 80;
  if (token.includes("volume")) return 110;
  const text = normalizeText(column?.label || column?.field);
  return Math.min(128, Math.max(96, text.length * 7 + 20));
};

const resolvePayload = (inspectionRows = []) => {
  const payload = pickBestPayload(inspectionRows);
  const masterColumns = normalizeMasterColumns(payload?.master_columns);
  const columns = masterColumns.length > 0 ? masterColumns : inferColumnsFromPayload(payload);

  const persiapanColumns =
    sectionColumns(columns, "persiapan").length > 0
      ? sectionColumns(columns, "persiapan")
      : FALLBACK_PERSIAPAN_COLUMNS;
  const checkColumns =
    sectionColumns(columns, "check").length > 0
      ? sectionColumns(columns, "check")
      : FALLBACK_CHECK_COLUMNS;
  const penambahanColumns =
    sectionColumns(columns, "penambahan").length > 0
      ? sectionColumns(columns, "penambahan")
      : FALLBACK_PENAMBAHAN_COLUMNS;
  const mccpColumns =
    sectionColumns(columns, "mccp").length > 0
      ? sectionColumns(columns, "mccp")
      : FALLBACK_MCCP_COLUMNS;

  const mainValues = {};
  [...persiapanColumns, ...checkColumns].forEach((column) => {
    mainValues[column.field] = normalizeText(getValueByExactKey(payload, column.field));
  });

  const penambahanRows = normalizeRowsByColumns(
    payload?.penambahan_rows ?? payload?.penambahanRows ?? payload?.penambahan,
    penambahanColumns,
    DEFAULT_PENAMBAHAN_ROWS
  );
  const mccpRows = normalizeRowsByColumns(
    payload?.mccp_rows ?? payload?.mccpRows ?? payload?.mccp,
    mccpColumns,
    DEFAULT_MCCP_ROWS
  );

  return {
    persiapanColumns,
    checkColumns,
    penambahanColumns,
    mccpColumns,
    mainValues,
    penambahanRows,
    mccpRows,
    created_by: normalizeText(payload?.created_by ?? payload?.createdBy),
    user: normalizeText(payload?.user ?? payload?._user),
  };
};

const renderSplitCheckValue = (rawValue) => {
  const parsed = parseSplitCheckValue(rawValue);
  const splitBoxStyle =
    "display:inline-flex; align-items:center; justify-content:center; min-width:26px; height:18px; border:1px solid #000; font-weight:700; font-size:10px; line-height:1;";
  return `
    <div style="display:flex; align-items:center; justify-content:center; gap:12px; font-size:10px; color:#111827;">
      <div style="display:flex; align-items:center; gap:4px;">
        <span style="font-weight:700;">L:</span>
        <span style="${splitBoxStyle}">${parsed.left ? "v" : ""}</span>
      </div>
      <div style="display:flex; align-items:center; gap:4px;">
        <span style="font-weight:700;">R:</span>
        <span style="${splitBoxStyle}">${parsed.right ? "v" : ""}</span>
      </div>
    </div>
  `;
};

const renderCheckValue = (column, rawValue) => {
  if (!isSplitCheckField(column)) {
    return `<div style="text-align:center; font-size:10px; color:#111827;">${escapeHtml(
      toDisplayText(rawValue)
    )}</div>`;
  }
  return renderSplitCheckValue(rawValue);
};

const renderPemakaianH2o2A3DetailHtml = (record = {}, options = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const payload = resolvePayload(inspectionRows);
  const sectionTitle = toDisplayText(options?.sectionTitle, "PEMAKAIAN H2O2 A3");
  const resolvedSubmitter = resolveSubmittedBy({ record, inspectionRows });
  const submittedBy =
    normalizeText(resolvedSubmitter).trim() && resolvedSubmitter !== "-"
      ? resolvedSubmitter
      : normalizeText(payload.created_by).trim() ||
        normalizeText(payload.user).trim() ||
        [...payload.penambahanRows, ...payload.mccpRows]
          .map((row) => normalizeText(row?.oleh).trim())
          .find((value) => value !== "") ||
        "-";

  const penambahanRows = toDisplayRows(
    payload.penambahanRows,
    payload.penambahanColumns,
    DEFAULT_PENAMBAHAN_ROWS
  );
  const mccpRows = toDisplayRows(payload.mccpRows, payload.mccpColumns, DEFAULT_MCCP_ROWS);
  const penambahanBlockWidth =
    payload.penambahanColumns.reduce((total, column) => total + toColumnWidth(column), 0) +
    OLEH_COLUMN_WIDTH;
  const mccpBlockWidth =
    payload.mccpColumns.reduce((total, column) => total + toColumnWidth(column), 0) +
    OLEH_COLUMN_WIDTH;
  const sheetWidth = PERSIAPAN_BLOCK_WIDTH + penambahanBlockWidth + mccpBlockWidth;
  const checkColumnCount = Math.max(payload.checkColumns.length, 1);
  const checkCellMinWidth = 250;
  const tableMinWidth = Math.max(sheetWidth, checkColumnCount * checkCellMinWidth);
  const persenWidth = sheetWidth > 0 ? `${(PERSIAPAN_BLOCK_WIDTH / sheetWidth) * 100}%` : "30%";

  return `
    <p class="section-title">${escapeHtml(sectionTitle)}</p>
    <div style="overflow-x:auto; padding-bottom:2px; margin-top:8px;">
      <table class="v2-table" style="width:100%; min-width:${tableMinWidth}px; table-layout:fixed; border:1px solid #000;">
        <tbody>
          <tr>
            <td style="padding:0; vertical-align:top; border:1px solid #000; width:${persenWidth};">
              <div style="padding:6px 4px; text-align:center; font-size:11px; font-weight:700; color:#111827; background:#f5f5f5; border-bottom:1px solid #000; letter-spacing:0.02em;">
                PERSIAPAN
              </div>
              <table class="v2-table" style="table-layout:fixed;">
                <tbody>
                  ${payload.persiapanColumns
                    .map(
                      (column) => `
                        <tr>
                          <td class="left" style="width:48%; font-weight:600; background:#fafafa;">
                            ${escapeHtml(normalizeText(column.label).toUpperCase())}
                          </td>
                          <td class="center" style="width:6%; font-weight:700;">:</td>
                          <td class="center" style="width:34%;">
                            ${escapeHtml(toDisplayText(payload.mainValues[column.field]))}
                          </td>
                          <td class="center" style="width:12%; font-weight:700; font-size:9px;">
                            ${escapeHtml(normalizeText(column.unit))}
                          </td>
                        </tr>
                      `
                    )
                    .join("")}
                  <tr>
                    <td class="left" style="width:48%; font-weight:600; background:#fafafa;">OLEH</td>
                    <td class="center" style="width:6%; font-weight:700;">:</td>
                    <td class="center" style="width:46%;" colspan="2">${escapeHtml(
                      toDisplayText(submittedBy)
                    )}</td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style="padding:0; vertical-align:top; border:1px solid #000;">
              <div style="padding:6px 4px; text-align:center; font-size:11px; font-weight:700; color:#111827; background:#f5f5f5; border-bottom:1px solid #000; letter-spacing:0.02em;">
                PENAMBAHAN H2O2
              </div>
              <table class="v2-table" style="table-layout:fixed;">
                <thead>
                  <tr>
                    ${payload.penambahanColumns
                      .map(
                        (column) => `
                          <th style="width:${toColumnWidth(column)}px;">
                            ${escapeHtml(normalizeText(column.label).toUpperCase())}
                          </th>
                        `
                      )
                      .join("")}
                    <th style="width:${OLEH_COLUMN_WIDTH}px;">OLEH</th>
                  </tr>
                </thead>
                <tbody>
                  ${penambahanRows
                    .map(
                      (row) => `
                        <tr>
                          ${payload.penambahanColumns
                            .map(
                              (column) => `
                                <td class="center" style="width:${toColumnWidth(column)}px;">
                                  ${escapeHtml(toDisplayText(row[column.field]))}
                                </td>
                              `
                            )
                            .join("")}
                          <td class="center" style="width:${OLEH_COLUMN_WIDTH}px;">
                            ${escapeHtml(toDisplayText(row.oleh))}
                          </td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </td>
            <td style="padding:0; vertical-align:top; border:1px solid #000;">
              <div style="padding:6px 4px; text-align:center; font-size:11px; font-weight:700; color:#111827; background:#f5f5f5; border-bottom:1px solid #000; letter-spacing:0.02em;">
                MCCP - 4 (H2O2:30-50%)
              </div>
              <div style="padding:4px 6px; text-align:center; font-size:10px; font-weight:700; color:#374151; background:#fafafa; border-bottom:1px solid #000;">
                CHECK SETIAP START PROD &amp; INTERVAL 6 JAM
              </div>
              <table class="v2-table" style="table-layout:fixed;">
                <thead>
                  <tr>
                    ${payload.mccpColumns
                      .map(
                        (column) => `
                          <th style="width:${toColumnWidth(column)}px;">
                            ${escapeHtml(normalizeText(column.label).toUpperCase())}
                          </th>
                        `
                      )
                      .join("")}
                    <th style="width:${OLEH_COLUMN_WIDTH}px;">OLEH</th>
                  </tr>
                </thead>
                <tbody>
                  ${mccpRows
                    .map(
                      (row) => `
                        <tr>
                          ${payload.mccpColumns
                            .map(
                              (column) => `
                                <td class="center" style="width:${toColumnWidth(column)}px;">
                                  ${escapeHtml(toDisplayText(row[column.field]))}
                                </td>
                              `
                            )
                            .join("")}
                          <td class="center" style="width:${OLEH_COLUMN_WIDTH}px;">
                            ${escapeHtml(toDisplayText(row.oleh))}
                          </td>
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td colspan="3" style="padding:6px 4px; text-align:center; font-size:20px; font-weight:700; letter-spacing:0.38em; color:#111827; background:#fafafa; border:1px solid #000;">
              CHECK
            </td>
          </tr>
          <tr>
            ${payload.checkColumns
              .map(
                (column) => `
                  <td style="padding:0; border:1px solid #000; vertical-align:top; width:${
                    100 / checkColumnCount
                  }%; min-width:${checkCellMinWidth}px;">
                    <table class="v2-table" style="table-layout:fixed;">
                      <tbody>
                        <tr>
                          <td class="left" style="width:48%; font-weight:700; background:#fafafa;">
                            ${escapeHtml(normalizeText(column.label).toUpperCase())}
                          </td>
                          <td style="width:52%;">
                            ${renderCheckValue(column, payload.mainValues[column.field])}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                `
              )
              .join("")}
          </tr>
        </tbody>
      </table>
    </div>
  `;
};

module.exports = { renderPemakaianH2o2A3DetailHtml };

