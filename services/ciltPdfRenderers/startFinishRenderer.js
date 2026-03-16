const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const { hasMeaningfulValue, resolvePrimaryPayload } = require("./packageRendererUtils");

const START_COLUMNS = [
  { key: "weight", label: "Weight" },
  { key: "twist", label: "Tube Twist" },
  { key: "overlap", label: "LS Overlap" },
  { key: "datePrint", label: "Date Printing" },
  { key: "surface", label: "Surface Printing" },
  { key: "ls", label: "LS" },
  { key: "ts", label: "TS" },
  { key: "sa", label: "SA" },
  { key: "inj", label: "Injection Test" },
  { key: "elec", label: "Electrolity Test" },
];

const FINISH_COLUMNS = [...START_COLUMNS, { key: "remarks", label: "Remarks" }];

const isFilledRow = (row = {}) =>
  Object.values(row || {}).some((value) => hasMeaningfulValue(value));

const renderStartFinishTable = (title, columns = [], rows = []) => `
  <div style="margin-bottom:18px;">
    <h4 style="margin:0 0 6px; text-align:center; font-weight:700; font-size:14px; color:#111827;">
      ${escapeHtml(title)}
    </h4>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:4%;">No</th>
          ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length === 0
            ? renderV2EmptyRow({ colspan: columns.length + 1 })
            : rows
                .map(
                  (row, rowIndex) => `
                    <tr>
                      <td class="center">${rowIndex + 1}</td>
                      ${columns
                        .map(
                          (column, columnIndex) => `
                            <td class="${columnIndex === 0 ? "left" : "center"}">
                              ${escapeHtml(toDisplayText(row?.[column.key]))}
                            </td>
                          `
                        )
                        .join("")}
                    </tr>
                  `
                )
                .join("")
        }
      </tbody>
    </table>
  </div>
`;

const renderStartFinishDetailHtml = (record = {}) => {
  const primaryPayload = resolvePrimaryPayload(record);
  const startRows = (Array.isArray(primaryPayload?.startProduksi)
    ? primaryPayload.startProduksi
    : []
  ).filter((row) => row && typeof row === "object" && !Array.isArray(row) && isFilledRow(row));
  const finishRows = (Array.isArray(primaryPayload?.finishProduksi)
    ? primaryPayload.finishProduksi
    : []
  ).filter((row) => row && typeof row === "object" && !Array.isArray(row) && isFilledRow(row));

  return `
    <p class="section-title">START &amp; FINISH</p>
    ${renderStartFinishTable("START PRODUKSI", START_COLUMNS, startRows)}
    ${renderStartFinishTable("FINISH PRODUKSI", FINISH_COLUMNS, finishRows)}
  `;
};

module.exports = { renderStartFinishDetailHtml };
