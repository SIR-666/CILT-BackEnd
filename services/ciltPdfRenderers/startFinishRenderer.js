const { escapeHtml, toDisplayText } = require("./rendererShared");
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

const renderExactStartFinishTable = (title, columns = [], rows = []) => `
  <div style="margin-bottom:18px;">
    <h3 style="text-align:center; font-weight:700; font-size:14px; margin:10px 0 6px; color:#111827;">
      ${escapeHtml(title)}
    </h3>
    <table style="width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:18px;">
      <thead>
        <tr>
          <th style="border:0.5px solid #000; padding:4px 6px; font-size:10px; text-align:center; background:#f2f2f2; width:4%;">
            No
          </th>
          ${columns
            .map(
              (column) => `
                <th style="border:0.5px solid #000; padding:4px 6px; font-size:10px; text-align:center; background:#f2f2f2;">
                  ${escapeHtml(column.label)}
                </th>
              `
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length === 0
            ? `
              <tr>
                <td colspan="${columns.length + 1}" style="border:0.5px solid #000; padding:4px 6px; font-size:10px; text-align:center;">
                  No data
                </td>
              </tr>
            `
            : rows
                .map(
                  (row, rowIndex) => `
                    <tr>
                      <td style="border:0.5px solid #000; padding:4px 6px; font-size:10px; text-align:center;">
                        ${rowIndex + 1}
                      </td>
                      ${columns
                        .map(
                          (column, columnIndex) => `
                            <td style="border:0.5px solid #000; padding:4px 6px; font-size:10px; text-align:${
                              columnIndex === 0 ? "left" : "center"
                            };">
                              ${escapeHtml(toDisplayText(row?.[column.key], "-"))}
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
    <div style="margin-top:10px;">
      ${renderExactStartFinishTable("START PRODUKSI", START_COLUMNS, startRows)}
      ${renderExactStartFinishTable("FINISH PRODUKSI", FINISH_COLUMNS, finishRows)}
    </div>
  `;
};

module.exports = { renderStartFinishDetailHtml };
