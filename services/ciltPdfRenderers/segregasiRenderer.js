const { escapeHtml, renderV2EmptyBlock, toDisplayText } = require("./rendererShared");

const hasMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const parseInspectionRows = (raw) => {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return parseInspectionRows(JSON.parse(trimmed));
    } catch (error) {
      return [];
    }
  }

  if (typeof raw === "object") {
    if (Array.isArray(raw.rows)) return raw.rows;
    if (Array.isArray(raw.data)) return raw.data;
    return [raw];
  }

  return [];
};

const normalizeRows = (raw) =>
  parseInspectionRows(raw).filter(
    (row) => row && typeof row === "object" && !Array.isArray(row)
  );

const isSegregasiRowFilled = (row = {}) =>
  hasMeaningfulValue(row?.type) ||
  hasMeaningfulValue(row?.job_type) ||
  hasMeaningfulValue(row?.prodType) ||
  row?.magazine === true ||
  row?.wastafel === true ||
  row?.palletPm === true ||
  row?.conveyor === true ||
  hasMeaningfulValue(row?.flavour) ||
  hasMeaningfulValue(row?.kodeProd) ||
  hasMeaningfulValue(row?.kodeExp) ||
  hasMeaningfulValue(row?.startTime) ||
  hasMeaningfulValue(row?.stopTime) ||
  hasMeaningfulValue(row?.counterOutfeed) ||
  hasMeaningfulValue(row?.totalOutfeed) ||
  hasMeaningfulValue(row?.waste) ||
  hasMeaningfulValue(row?.startNum) ||
  hasMeaningfulValue(row?.stopNum);

const mergeSegregasiRows = (record = {}, inspectionRows = []) => {
  const rowsFromInspection = Array.isArray(inspectionRows)
    ? inspectionRows.filter(
        (row) => row && typeof row === "object" && !Array.isArray(row)
      )
    : [];
  const descriptionRows = normalizeRows(record?.descriptionData);
  const descriptionMetaRows = normalizeRows(record?.descriptionDataWithMeta);
  const remarksRows = normalizeRows(record?.remarks).filter(isSegregasiRowFilled);

  const totalRows = Math.max(
    rowsFromInspection.length,
    descriptionRows.length,
    descriptionMetaRows.length,
    remarksRows.length
  );

  if (totalRows === 0) return [];

  const mergedRows = Array.from({ length: totalRows }, (_, index) => ({
    ...(descriptionRows[index] || remarksRows[index] || {}),
    ...(descriptionMetaRows[index] || {}),
    ...(rowsFromInspection[index] || {}),
  }));
  const filledRows = mergedRows.filter(isSegregasiRowFilled);
  return filledRows.length > 0 ? filledRows : mergedRows;
};

const renderInfoTable = (rows = []) => `
  <table style="width:100%; border-collapse:collapse; table-layout:fixed;">
    <tbody>
      ${rows
        .map(
          (row) => `
            <tr>
              <td style="border:1px solid #e5e7eb; background:#f8fafc; color:#374151; font-size:10px; font-weight:600; padding:3px 5px; width:34%;">
                ${escapeHtml(toDisplayText(row?.label, "-"))}
              </td>
              <td style="border:1px solid #e5e7eb; color:#111827; font-size:10px; padding:3px 5px; word-break:break-word;">
                ${escapeHtml(toDisplayText(row?.value, "-"))}
              </td>
            </tr>
          `
        )
        .join("")}
    </tbody>
  </table>
`;

const renderSegregasiCard = (row = {}, index = 0) => {
  const resolvedType = toDisplayText(row?.type || row?.job_type, "-");
  const isChangeVariant =
    String(resolvedType).trim().toLowerCase() === "change variant";
  const auditUser = toDisplayText(row?.user || row?.lastModifiedBy, "-");
  const auditTime = toDisplayText(row?.time || row?.lastModifiedTime, "-");

  return `
    <div style="border:1px solid #d1d5db; border-radius:6px; padding:7px; background:#ffffff; line-height:1.15; break-inside:avoid; page-break-inside:avoid;">
      <div style="text-align:center; font-size:11px; font-weight:700; color:#1f2937; background:#f8fafc; border:1px solid #e5e7eb; border-radius:4px; padding:4px 6px; margin-bottom:6px;">
        Entry ${index + 1}
      </div>

      <div style="margin-bottom:6px;">
        <div style="font-size:9px; font-weight:700; color:#166534; margin-bottom:4px;">Segregasi</div>
        ${renderInfoTable([
          { label: "Type", value: resolvedType },
          { label: "Prod Type", value: toDisplayText(row?.prodType, "-") },
          { label: "TO", value: isChangeVariant ? toDisplayText(row?.to, "-") : "—" },
        ])}
      </div>

      <div style="margin-bottom:6px;">
        <div style="font-size:10px; font-weight:700; color:#166534; margin-bottom:4px;">Description</div>
        ${renderInfoTable([
          { label: "Flavour", value: toDisplayText(row?.flavour, "-") },
          { label: "Kode Prod.", value: toDisplayText(row?.kodeProd, "-") },
          { label: "Kode Exp", value: toDisplayText(row?.kodeExp, "-") },
          { label: "Start", value: toDisplayText(row?.startTime, "-") },
          { label: "Stop", value: toDisplayText(row?.stopTime, "-") },
          { label: "Outfeed", value: toDisplayText(row?.counterOutfeed, "-") },
          { label: "Total Outfeed", value: toDisplayText(row?.totalOutfeed, "-") },
          { label: "Waste", value: toDisplayText(row?.waste, "-") },
          { label: "Start Hours", value: toDisplayText(row?.startNum, "-") },
          { label: "Stop Hours", value: toDisplayText(row?.stopNum, "-") },
        ])}
      </div>

      <div style="margin-bottom:6px;">
        <div style="font-size:10px; font-weight:700; color:#166534; margin-bottom:4px;">Equipment Status</div>
        ${renderInfoTable([
          { label: "Magazine", value: row?.magazine ? "Ya" : "-" },
          { label: "Wastafel", value: row?.wastafel ? "Ya" : "-" },
          { label: "Pallet PM", value: row?.palletPm ? "Ya" : "-" },
          { label: "Conveyor", value: row?.conveyor ? "Ya" : "-" },
        ])}
      </div>

      ${
        row?.user || row?.time || row?.lastModifiedBy || row?.lastModifiedTime
          ? `
            <div style="padding-top:5px; border-top:1px solid #e5e7eb; font-size:9px; color:#6b7280;">
              <div>User: ${escapeHtml(auditUser)}</div>
              <div>Time: ${escapeHtml(auditTime)}</div>
            </div>
          `
          : ""
      }
    </div>
  `;
};

const renderSegregasiDetailHtml = (record = {}, inspectionRows = null) => {
  const sourceRows =
    inspectionRows && Array.isArray(inspectionRows)
      ? inspectionRows
      : parseInspectionRows(record?.inspectionData);
  const rows = mergeSegregasiRows(record, sourceRows);

  if (rows.length === 0) {
    return renderV2EmptyBlock();
  }

  const pageGroups = [];
  for (let index = 0; index < rows.length; index += 3) {
    pageGroups.push(rows.slice(index, index + 3));
  }

  const pagesHtml = pageGroups
    .map((pageRows, pageIndex) => {
      const pageColumnCount = Math.min(3, Math.max(1, pageRows.length));
      const paddedRows =
        pageRows.length < pageColumnCount
          ? [
              ...pageRows,
              ...Array.from({ length: pageColumnCount - pageRows.length }, () => null),
            ]
          : pageRows;

      return `
        <div ${
          pageIndex === 0
            ? ""
            : 'style="page-break-before:always; break-before:page; padding-top:6px;"'
        }>
          <div style="display:grid; grid-template-columns:repeat(${pageColumnCount}, minmax(0, 1fr)); gap:6px; align-items:start;">
            ${paddedRows
              .map((row, columnIndex) => {
                const absoluteIndex = pageIndex * 3 + columnIndex;
                return `
                  <div style="min-width:0;">
                    ${
                      row
                        ? renderSegregasiCard(row, absoluteIndex)
                        : '<div style="min-height:1px;"></div>'
                    }
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  return `<div style="padding-bottom:6px;">${pagesHtml}</div>`;
};

module.exports = { renderSegregasiDetailHtml };
