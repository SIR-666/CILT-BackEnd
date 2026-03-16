const { escapeHtml, toDisplayText } = require("./rendererShared");
const {
  filterRowsByFields,
  getValueByExactKey,
  isCheckedMarker,
  resolveInspectionRows,
} = require("./packageRendererUtils");

const renderH2o2SprayDetailHtml = (record = {}) => {
  const inspectionRows = resolveInspectionRows(record);
  const rows = filterRowsByFields(inspectionRows, ["jam", "konsentrasi", "volume", "kode"]);
  const hasLanjutanLabel = Array.isArray(inspectionRows)
    ? inspectionRows.some((row) => isCheckedMarker(getValueByExactKey(row, "lanjutan")))
    : false;

  const columns = [
    { label: "No", width: "6%", align: "center" },
    { label: "Jam Pengecekan", width: "15%", align: "center" },
    { label: "Konsentrasi (>35-50%) (MCCP 03)", width: "24%", align: "center" },
    { label: "Volume", width: "12%", align: "center" },
    { label: "Kode Operator", width: "15%", align: "center" },
    { label: "User", width: "14%", align: "center" },
    { label: "Time", width: "14%", align: "center" },
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
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "konsentrasi"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "volume"), ""))}
                </td>
                <td style="padding:12px 8px; text-align:center; color:#111827; border:1px solid #000; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "kode"), ""))}
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
        ${
          hasLanjutanLabel
            ? `
              <div style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%) rotate(-18deg); font-size:30px; font-style:italic; font-weight:700; color:rgba(173, 29, 44, 0.62); letter-spacing:1px; white-space:nowrap; border:3px solid rgba(173, 29, 44, 0.6); border-radius:6px; padding:4px 16px; z-index:2; pointer-events:none;">
                Lanjutan
              </div>
            `
            : ""
        }
        <table style="position:relative; z-index:1; width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px;">
          <thead>
            <tr>
              ${columns
                .map(
                  (column) => `
                    <th style="width:${column.width}; padding:12px 8px; text-align:${column.align}; border:1px solid #000; background:#f2f2f2; color:#111827; white-space:normal; vertical-align:middle; word-break:break-word; overflow-wrap:anywhere;">
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

module.exports = { renderH2o2SprayDetailHtml };
