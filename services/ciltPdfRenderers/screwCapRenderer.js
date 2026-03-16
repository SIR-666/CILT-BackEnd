const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const { filterRowsByFields, getValueByExactKey, resolveInspectionRows } = require("./packageRendererUtils");

const renderScrewCapDetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const rows = filterRowsByFields(inspectionRows, ["jam", "ofNo", "boxNo", "qtyLabel"]);

  const bodyRows =
    rows.length === 0
      ? renderV2EmptyRow({ colspan: 7 })
      : rows
          .map(
            (row, index) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "jam"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "ofNo"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "boxNo"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "qtyLabel"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "user"), ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(getValueByExactKey(row, "time"), ""))}</td>
              </tr>
            `
          )
          .join("");

  return `
    <p class="section-title">PEMAKAIAN SCREW CAP</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:5%;">No</th>
          <th style="width:15%;">Jam</th>
          <th style="width:20%;">Of No.</th>
          <th style="width:20%;">Box No.</th>
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

module.exports = { renderScrewCapDetailHtml };

