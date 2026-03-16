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

const toYesNo = (value) => (value === true ? "Ya" : "");

const renderSegregasiDetailHtml = (record = {}, inspectionRows = null) => {
  const sourceRows =
    inspectionRows && Array.isArray(inspectionRows)
      ? inspectionRows
      : parseInspectionRows(record?.inspectionData);
  const rows = mergeSegregasiRows(record, sourceRows);

  if (rows.length === 0) {
    return renderV2EmptyBlock();
  }

  const rowMarkup = rows
    .map((row, index) => {
      const typeValue = toDisplayText(row?.type || row?.job_type);
      const isChangeVariant =
        String(typeValue || "")
          .trim()
          .toLowerCase() === "change variant";
      const toVariantValue = isChangeVariant ? toDisplayText(row?.to, "") : "";
      const auditUser = toDisplayText(row?.user || row?.lastModifiedBy);
      const auditTime = toDisplayText(row?.time || row?.lastModifiedTime);

      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td class="left">${escapeHtml(typeValue)}</td>
          <td class="left">${escapeHtml(toDisplayText(row?.prodType))}</td>
          <td class="left">${escapeHtml(toVariantValue)}</td>
          <td class="left">${escapeHtml(toDisplayText(row?.flavour))}</td>
          <td class="left">${escapeHtml(toDisplayText(row?.kodeProd))}</td>
          <td class="left">${escapeHtml(toDisplayText(row?.kodeExp))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.startTime))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.stopTime))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.counterOutfeed))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.totalOutfeed))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.waste))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.startNum))}</td>
          <td class="center">${escapeHtml(toDisplayText(row?.stopNum))}</td>
          <td class="center">${escapeHtml(toYesNo(row?.magazine))}</td>
          <td class="center">${escapeHtml(toYesNo(row?.wastafel))}</td>
          <td class="center">${escapeHtml(toYesNo(row?.palletPm))}</td>
          <td class="center">${escapeHtml(toYesNo(row?.conveyor))}</td>
          <td class="left">${escapeHtml(auditUser)}</td>
          <td class="center">${escapeHtml(auditTime)}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <p class="section-title">SEGREGASI</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th rowspan="2" style="width:4%;">No</th>
          <th colspan="3">Segregasi</th>
          <th colspan="10">Description</th>
          <th colspan="4">Equipment</th>
          <th colspan="2">Audit</th>
        </tr>
        <tr>
          <th style="width:10%; text-align:left;">Type</th>
          <th style="width:10%; text-align:left;">Prod Type</th>
          <th style="width:8%; text-align:left;">TO</th>
          <th style="width:8%; text-align:left;">Flavour</th>
          <th style="width:8%; text-align:left;">Kode Prod</th>
          <th style="width:8%; text-align:left;">Kode Exp</th>
          <th style="width:6%;">Start</th>
          <th style="width:6%;">Stop</th>
          <th style="width:7%;">Outfeed</th>
          <th style="width:7%;">Total Outfeed</th>
          <th style="width:6%;">Waste</th>
          <th style="width:6%;">Start Num</th>
          <th style="width:6%;">Stop Num</th>
          <th style="width:6%;">Magazine</th>
          <th style="width:6%;">Wastafel</th>
          <th style="width:6%;">Pallet PM</th>
          <th style="width:6%;">Conveyor</th>
          <th style="width:8%; text-align:left;">User</th>
          <th style="width:8%;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${rowMarkup}
      </tbody>
    </table>
  `;
};

module.exports = { renderSegregasiDetailHtml };
