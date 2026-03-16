const { escapeHtml, toDisplayText } = require("./rendererShared");
const {
  filterRowsByFields,
  getValueByExactKey,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const renderScrewCapDetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const rows = filterRowsByFields(inspectionRows, ["jam", "ofNo", "boxNo", "qtyLabel"]);

  const columns = [
    { label: "No", width: "5%", minWidth: "40px", align: "center" },
    { label: "Jam", width: "15%", minWidth: "100px", align: "center" },
    { label: "Of No.", width: "20%", minWidth: "100px", align: "center" },
    { label: "Box No.", width: "20%", minWidth: "100px", align: "center" },
    { label: "Qty Label", width: "20%", minWidth: "100px", align: "center" },
    { label: "User", width: "10%", minWidth: "60px", align: "center" },
    { label: "Time", width: "10%", minWidth: "50px", align: "center" },
  ];

  const bodyRows =
    rows.length === 0
      ? `
        <tr>
          <td colspan="${columns.length}" style="padding:20px 8px; text-align:center; color:#666; font-style:italic; border:1px solid #000;">
            Tidak ada data yang diinput
          </td>
        </tr>
      `
      : rows
          .map(
            (row, rowIndex) => `
              <tr style="break-inside:avoid; page-break-inside:avoid;">
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${rowIndex + 1}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "jam"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "ofNo"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "boxNo"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "qtyLabel"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "user"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "time"), ""))}
                </td>
              </tr>
            `
          )
          .join("");

  return `
    <div style="margin-top:10px; margin-bottom:14px; break-inside:auto; page-break-inside:auto;">
      <div style="position:relative;">
        <table style="position:relative; z-index:1; width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px;">
          <thead>
            <tr>
              ${columns
                .map(
                  (column) => `
                    <th style="width:${column.width}; min-width:${column.minWidth}; padding:12px 8px; text-align:${column.align}; border:1px solid #000; background:#f2f2f2; color:#111827; white-space:normal; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
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

module.exports = { renderScrewCapDetailHtml };
