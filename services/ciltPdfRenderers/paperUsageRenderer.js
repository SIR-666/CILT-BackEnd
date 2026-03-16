const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const {
  filterRowsByFields,
  getValueByExactKey,
  isCheckedMarker,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const renderPaperUsageDetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const rows = filterRowsByFields(inspectionRows, ["jam", "boxNo", "pdPaper", "qtyLabel"]);
  const cekAlergenKemasan =
    Array.isArray(inspectionRows) &&
    inspectionRows.some(
      (row) =>
        isCheckedMarker(getValueByExactKey(row, "cekAlergenKemasan")) ||
        isCheckedMarker(getValueByExactKey(row, "cekLabelAlergenKemasan"))
    );

  const bodyRows =
    rows.length === 0
      ? renderV2EmptyRow({ colspan: 7 })
      : rows
          .map(
            (row, index) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "jam"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "boxNo"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "pdPaper"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "qtyLabel"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "user"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "time"), ""))}</td>
              </tr>
            `
          )
          .join("");

  return `
    <p class="section-title">PEMAKAIAN PAPER</p>
    <div style="display:flex; justify-content:flex-end; align-items:center; gap:8px; margin:6px 0 8px;">
      <span style="width:14px; height:14px; border:2px solid #111; display:inline-flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;">
        ${cekAlergenKemasan ? "v" : ""}
      </span>
      <span style="font-weight:700; font-size:10px; color:#111827;">CEK LABEL ALERGEN KEMASAN</span>
    </div>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:5%;">No</th>
          <th style="width:15%;">Jam</th>
          <th style="width:20%;">Box No.</th>
          <th style="width:20%;">PD. Paper</th>
          <th style="width:20%;">Qty Label</th>
          <th style="width:10%;">User</th>
          <th style="width:10%;">Time</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
};

module.exports = { renderPaperUsageDetailHtml };

