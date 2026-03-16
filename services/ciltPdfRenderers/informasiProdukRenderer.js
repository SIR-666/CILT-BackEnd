const { escapeHtml, parseJsonArray, toDisplayText } = require("./rendererShared");

const PAPER_GROUPS = Object.freeze([
  { key: "g1", box: "col1", date: "col2", time: "col3" },
  { key: "g2", box: "col4", date: "col5", time: "col6" },
  { key: "g3", box: "col7", date: "col8", time: "col9" },
  { key: "g4", box: "col10", date: "col11", time: "col12" },
]);

const getPrimaryPayload = (record = {}) => {
  const inspectionRows = parseJsonArray(record?.inspectionData);
  return inspectionRows.find(
    (row) => row && typeof row === "object" && !Array.isArray(row)
  ) || {};
};

const buildProductInfoRows = (productInfo = {}) => [
  ["Product Name", productInfo?.productName, "Production Date", productInfo?.productionDate],
  ["Date / Shift", productInfo?.dateShift, "Expired Date", productInfo?.expiredDate],
  ["Prod Start", productInfo?.prodStart, "Hour Meter Start", productInfo?.hourMeterStart],
  ["Prod Stop", productInfo?.prodStop, "Hour Meter Stop", productInfo?.hourMeterStop],
  [
    "Carton Sucked Off",
    `${toDisplayText(productInfo?.cartonSuckedOff)} pcs`,
    "Carton Filled",
    `${toDisplayText(productInfo?.cartonFilled)} pcs`,
  ],
  [
    "Carton Diverted",
    `${toDisplayText(productInfo?.cartonDiverted)} pcs`,
    "Carton Produced",
    `${toDisplayText(productInfo?.cartonProduced)} pcs`,
  ],
];

const renderInformasiProdukTable = (productInfo = {}) => {
  const rows = buildProductInfoRows(productInfo)
    .map(
      (row) => `
        <tr>
          <td class="left" style="width:22%; font-weight:700; background:#e7f2ed;">${escapeHtml(
            row[0]
          )}</td>
          <td class="left" style="width:28%;">${escapeHtml(toDisplayText(row[1]))}</td>
          <td class="left" style="width:22%; font-weight:700; background:#e7f2ed;">${escapeHtml(
            row[2]
          )}</td>
          <td class="left" style="width:28%;">${escapeHtml(toDisplayText(row[3]))}</td>
        </tr>
      `
    )
    .join("");

  return `
    <p class="section-title">INFORMASI PRODUK</p>
    <table class="v2-table">
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

const renderPaperGroupCell = (row = {}, group = {}) => `
  <div style="display:grid; row-gap:3px; text-align:left;">
    <div><strong>Box No:</strong> ${escapeHtml(toDisplayText(row?.[group.box]))}</div>
    <div><strong>Start Date:</strong> ${escapeHtml(toDisplayText(row?.[group.date]))}</div>
    <div><strong>Start Time:</strong> ${escapeHtml(toDisplayText(row?.[group.time]))}</div>
  </div>
`;

const renderPaperAklimatisasiTable = (paperRows = []) => {
  const rowsForDisplay = paperRows.length > 0 ? paperRows : [{}];
  const tableRows = rowsForDisplay
    .map((row, rowIndex) => {
      const groupCells = PAPER_GROUPS.map(
        (group) =>
          `<td class="left" style="vertical-align:top;">${renderPaperGroupCell(
            row,
            group
          )}</td>`
      ).join("");
      return `<tr><td class="center" style="width:42px;">${rowIndex + 1}</td>${groupCells}</tr>`;
    })
    .join("");

  return `
    <p class="section-title">PAPER AKLIMATISASI</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:42px;">No</th>
          <th>Group 1</th>
          <th>Group 2</th>
          <th>Group 3</th>
          <th>Group 4</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
};

const renderInformasiProdukDetailHtml = (record = {}) => {
  const payload = getPrimaryPayload(record);
  const productInfo =
    payload?.productInfo && typeof payload.productInfo === "object"
      ? payload.productInfo
      : {};
  const paperRows = Array.isArray(payload?.paperRows) ? payload.paperRows : [];

  return `
    ${renderInformasiProdukTable(productInfo)}
    ${renderPaperAklimatisasiTable(paperRows)}
  `;
};

module.exports = { renderInformasiProdukDetailHtml };
