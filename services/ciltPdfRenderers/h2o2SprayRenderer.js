const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const {
  filterRowsByFields,
  getValueByExactKey,
  isCheckedMarker,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const renderH2o2SprayDetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const rows = filterRowsByFields(inspectionRows, ["jam", "konsentrasi", "volume", "kode"]);
  const hasLanjutanLabel = inspectionRows.some((row) =>
    isCheckedMarker(getValueByExactKey(row, "lanjutan"))
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
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "konsentrasi"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "volume"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "kode"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "user"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "time"), ""))}</td>
              </tr>
            `
          )
          .join("");

  return `
    <p class="section-title">PENGECEKAN H2O2 ( SPRAY )</p>
    <div style="position:relative;">
      ${
        hasLanjutanLabel
          ? `
            <div style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%) rotate(-18deg); font-size:30px; font-style:italic; font-weight:700; color:rgba(173, 29, 44, 0.62); letter-spacing:1px; white-space:nowrap; border:3px solid rgba(173, 29, 44, 0.6); border-radius:6px; padding:4px 16px; z-index:2; pointer-events:none;">
              Lanjutan
            </div>
          `
          : ""
      }
      <table class="v2-table" style="position:relative; z-index:1;">
        <thead>
          <tr>
            <th style="width:6%;">No</th>
            <th style="width:15%;">Jam Pengecekan</th>
            <th style="width:24%;">Konsentrasi (&gt;35-50%) (MCCP 03)</th>
            <th style="width:12%;">Volume</th>
            <th style="width:15%;">Kode Operator</th>
            <th style="width:14%;">User</th>
            <th style="width:14%;">Time</th>
          </tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    </div>
  `;
};

module.exports = { renderH2o2SprayDetailHtml };

