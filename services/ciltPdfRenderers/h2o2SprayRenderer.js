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
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "konsentrasi"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "volume"), ""))}
                </td>
                <td class="pkg-cell">
                  ${escapeHtml(toDisplayText(getValueByExactKey(row, "kode"), ""))}
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
      <div class="pkg-stage">
        ${
          hasLanjutanLabel
            ? `
              <div class="pkg-watermark">
                Lanjutan
              </div>
            `
            : ""
        }
        <table class="pkg-table">
          <thead>
            <tr>
              ${columns
                .map(
                  (column) => `
                    <th class="pkg-head" style="width:${column.width}; text-align:${column.align};">
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
