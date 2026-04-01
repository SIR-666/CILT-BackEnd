const { escapeHtml, toDisplayText } = require("./rendererShared");
const {
  filterRowsByFields,
  getValueByExactKey,
  isCheckedMarker,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const renderPaperUsageDetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const rows = filterRowsByFields(inspectionRows, ["jam", "boxNo", "pdPaper", "qtyLabel"]);
  const cekAlergenKemasan = Array.isArray(inspectionRows)
    ? inspectionRows.some(
        (row) =>
          isCheckedMarker(getValueByExactKey(row, "cekAlergenKemasan")) ||
          isCheckedMarker(getValueByExactKey(row, "cekLabelAlergenKemasan"))
      )
    : false;

  const columns = [
    { label: "No", width: "5%", minWidth: "40px", align: "center" },
    { label: "Jam", width: "15%", minWidth: "100px", align: "center" },
    { label: "Box No.", width: "20%", minWidth: "80px", align: "center" },
    { label: "PD. Paper", width: "20%", minWidth: "90px", align: "center" },
    { label: "Qty Label", width: "20%", minWidth: "100px", align: "center" },
    { label: "User", width: "10%", minWidth: "80px", align: "center" },
    { label: "Time", width: "10%", minWidth: "50px", align: "center" },
  ];

  const bodyRows =
    rows.length === 0
      ? `
        <tr>
          <td class="pkg-empty" colspan="${columns.length}">
            Tidak ada data yang diinput
          </td>
        </tr>
      `
      : rows
          .map(
            (row, rowIndex) => `
              <tr>
                <td class="pkg-cell">
                  ${rowIndex + 1}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "jam"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "boxNo"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "pdPaper"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "qtyLabel"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "user"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "time"), ""))}
                </td>
              </tr>
            `
          )
          .join("");

  return `
    <div class="pkg-wrap">
      <div class="pkg-checkline">
        <div></div>
        <div class="pkg-checkline-right">
          <div class="pkg-checkbox">
            ${cekAlergenKemasan ? "v" : ""}
          </div>
          <span class="pkg-checklabel">
            CEK LABEL ALERGEN KEMASAN
          </span>
        </div>
      </div>
      <div class="pkg-stage" style="margin-top:8px;">
        <table class="pkg-table">
          <thead>
            <tr>
              ${columns
                .map(
                  (column) => `
                    <th class="pkg-head" style="width:${column.width}; min-width:${column.minWidth}; text-align:${column.align};">
                      ${column.label}
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
      </div>
    </div>
  `;
};

module.exports = { renderPaperUsageDetailHtml };
