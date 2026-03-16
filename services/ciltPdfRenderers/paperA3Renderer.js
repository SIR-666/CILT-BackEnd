const {
  escapeHtml,
  renderV2EmptyRow,
  resolveSubmittedBy,
  toDisplayText,
} = require("./rendererShared");
const {
  getValueByExactKey,
  isCheckedMarker,
  normalizeText,
  normalizeToken,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const PAPER_META_TOKENS = new Set([
  "id",
  "saved",
  "ceklabelalergenkemasan",
  "cekalergenkemasan",
  "mastercolumns",
  "_user",
  "_time",
  "user",
  "time",
  "paperrows",
]);

const normalizeSectionToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");

const isPaperCheckboxColumn = (columnOrField) => {
  const source =
    typeof columnOrField === "string"
      ? columnOrField
      : columnOrField?.key || columnOrField?.field || columnOrField?.label;
  const token = normalizeToken(source);
  return ["kondisi", "splicing"].some((keyword) => token.includes(keyword));
};

const isMetaField = (key) => PAPER_META_TOKENS.has(normalizeToken(key));

const toTitleLabel = (raw) =>
  normalizeText(raw)
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bNo\b/g, "No.")
    .replace(/\bQty\b/g, "Qty")
    .replace(/\bMpm\b/g, "MPM");

const toColumnLabel = (field, fallback = "") => {
  const fallbackText = normalizeText(fallback).trim();
  if (fallbackText) return fallbackText;

  const normalized = normalizeText(field)
    .replace(/^mpm_strip_/i, "")
    .replace(/_paper$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/count(\d+)/gi, "count $1")
    .trim();

  return toTitleLabel(normalized);
};

const toGroupMeta = (column = {}, order = 0, fallbackPosition = 0) => {
  const sectionToken = normalizeSectionToken(
    column?.section || column?.group || column?.groupKey
  );

  if (sectionToken === "papermain") {
    return {
      groupKey: "paper-main",
      groupLabel: normalizeText(column?.group_label || "PAPER"),
    };
  }
  if (sectionToken === "papersub") {
    return {
      groupKey: "paper-sub",
      groupLabel: normalizeText(column?.group_label || "PAPER"),
    };
  }
  if (sectionToken === "mpmstrip") {
    return {
      groupKey: "mpm-strip",
      groupLabel: normalizeText(column?.group_label || "MPM STRIP"),
    };
  }

  const position =
    Number.isFinite(Number(fallbackPosition)) && Number(fallbackPosition) > 0
      ? Number(fallbackPosition)
      : Number(order);

  if (Number.isFinite(position)) {
    if (position >= 1 && position <= 6) return { groupKey: "paper-main", groupLabel: "PAPER" };
    if (position >= 7 && position <= 8) return { groupKey: "paper-sub", groupLabel: "PAPER" };
    if (position >= 9 && position <= 11) return { groupKey: "mpm-strip", groupLabel: "MPM STRIP" };
  }

  return { groupKey: "inspeksi", groupLabel: "INSPEKSI" };
};

const finalizeColumns = (rawColumns = []) => {
  const seen = new Set();

  return (Array.isArray(rawColumns) ? rawColumns : [])
    .map((column, index) => {
      const key = normalizeText(column?.key ?? column?.field ?? column?.name).trim();
      if (!key || isMetaField(key)) return null;

      const token = normalizeToken(key);
      if (!token || seen.has(token)) return null;
      seen.add(token);

      const orderNo = Number(column?.order_no ?? column?.order ?? index + 1);
      const label = toColumnLabel(key, column?.label);
      const groupMeta = toGroupMeta(column, orderNo, index + 1);

      return {
        key,
        label,
        order: Number.isFinite(orderNo) ? orderNo : index + 1,
        width: Math.min(Math.max(label.length * 7 + 28, 88), 130),
        groupKey: groupMeta.groupKey,
        groupLabel: groupMeta.groupLabel,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);
};

const resolveBaseRows = (inspectionRows = []) =>
  (Array.isArray(inspectionRows) ? inspectionRows : [])
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .flatMap((row) =>
      Array.isArray(row?.paperRows)
        ? row.paperRows.filter((inner) => inner && typeof inner === "object")
        : [row]
    );

const hasInspectionValue = (row = {}) =>
  Object.entries(row || {}).some(([key, value]) => {
    if (isMetaField(key)) return false;
    return normalizeText(value).trim() !== "";
  });

const renderPaperA3DetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const baseRows = resolveBaseRows(inspectionRows);

  const masterColumns =
    inspectionRows.find(
      (row) =>
        row && typeof row === "object" && Array.isArray(row.master_columns) && row.master_columns.length > 0
    )?.master_columns || [];

  const columnsFromMaster = finalizeColumns(
    masterColumns.map((column, index) => ({
      key: column?.field ?? column?.key ?? column?.name ?? "",
      label: column?.label ?? "",
      order_no: column?.order_no ?? column?.order ?? index + 1,
      section: column?.section ?? column?.group ?? column?.groupKey ?? "",
      group_label: column?.group_label ?? column?.groupLabel ?? "",
    }))
  );

  const columns =
    columnsFromMaster.length > 0
      ? columnsFromMaster
      : (() => {
          const orderedKeys = [];
          const seen = new Set();

          baseRows.forEach((row) => {
            Object.keys(row || {}).forEach((key) => {
              if (isMetaField(key)) return;
              const token = normalizeToken(key);
              if (!token || seen.has(token)) return;
              seen.add(token);
              orderedKeys.push(key);
            });
          });

          return finalizeColumns(
            orderedKeys.map((key, index) => ({
              key,
              order_no: index + 1,
            }))
          );
        })();

  const dataRows = baseRows.filter((row) => hasInspectionValue(row));
  const cekAlergenKemasan = inspectionRows.some(
    (row) =>
      isCheckedMarker(getValueByExactKey(row, "cekLabelAlergenKemasan")) ||
      isCheckedMarker(getValueByExactKey(row, "cekAlergenKemasan"))
  );
  const submittedBy = resolveSubmittedBy({ record, inspectionRows });

  const groupedHeaderCells = [];
  columns.forEach((column) => {
    const current = groupedHeaderCells[groupedHeaderCells.length - 1];
    const key = normalizeText(column.groupKey || column.groupLabel || "inspeksi");
    const label = normalizeText(column.groupLabel || "INSPEKSI");

    if (current && current.key === key) {
      current.colspan += 1;
      current.width += column.width;
      return;
    }

    groupedHeaderCells.push({
      key,
      label,
      colspan: 1,
      width: column.width,
    });
  });

  const tableMinWidth = Math.max(
    860,
    48 + columns.reduce((sum, column) => sum + Math.max(40, Math.round(column.width)), 0)
  );

  const bodyRows =
    dataRows.length === 0 || columns.length === 0
      ? renderV2EmptyRow({ colspan: Math.max(1, columns.length + 1) })
      : dataRows
          .map(
            (row, rowIndex) => `
              <tr>
                <td class="center">${rowIndex + 1}</td>
                ${columns
                  .map((column) => {
                    if (isPaperCheckboxColumn(column)) {
                      const hasMarker =
                        normalizeText(getValueByExactKey(row, column.key)).trim() !== "";
                      return `
                        <td class="center">
                          <span style="width:14px; height:14px; border:1px solid #111; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; line-height:1; background:#fff;">
                            ${hasMarker ? "v" : ""}
                          </span>
                        </td>
                      `;
                    }

                    return `
                      <td class="center">
                        ${escapeHtml(toDisplayText(getValueByExactKey(row, column.key)))}
                      </td>
                    `;
                  })
                  .join("")}
              </tr>
            `
          )
          .join("");

  return `
    <p class="section-title">PAPER A3</p>
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid #000; background:#fafafa; padding:8px 10px; margin:8px 0; font-size:10px; color:#111827;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="width:14px; height:14px; border:1px solid #111; display:inline-flex; align-items:center; justify-content:center; font-weight:700; font-size:10px; line-height:1; background:#fff;">
          ${cekAlergenKemasan ? "v" : ""}
        </span>
        <span style="font-weight:700;">CEK LABEL ALERGEN KEMASAN</span>
      </div>
      <div>
        <strong>Submitted By:</strong> ${escapeHtml(toDisplayText(submittedBy))}
      </div>
    </div>
    <table class="v2-table" style="min-width:${tableMinWidth}px; table-layout:fixed;">
      <thead>
        <tr>
          <th rowspan="2" style="width:48px;">No</th>
          ${groupedHeaderCells
            .map(
              (group) => `
                <th colspan="${group.colspan}">
                  ${escapeHtml(toDisplayText(group.label, "INSPEKSI"))}
                </th>
              `
            )
            .join("")}
        </tr>
        <tr>
          ${columns
            .map(
              (column) => `
                <th style="width:${Math.max(40, Math.round(column.width))}px;">
                  ${escapeHtml(toDisplayText(column.label, ""))}
                </th>
              `
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
};

module.exports = { renderPaperA3DetailHtml };

