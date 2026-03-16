const { escapeHtml, parseJsonArray, toDisplayText } = require("./rendererShared");

const PAPER_GROUPS = Object.freeze([
  { key: "g1", box: "col1", date: "col2", time: "col3" },
  { key: "g2", box: "col4", date: "col5", time: "col6" },
  { key: "g3", box: "col7", date: "col8", time: "col9" },
  { key: "g4", box: "col10", date: "col11", time: "col12" },
]);

const getPrimaryPayload = (record = {}) => {
  const inspectionRows = parseJsonArray(record?.inspectionData);
  return (
    inspectionRows.find(
      (row) => row && typeof row === "object" && !Array.isArray(row)
    ) || {}
  );
};

const buildProductInfoRows = (productInfo = {}) => [
  [
    "Product Name",
    productInfo?.productName,
    "Production Date",
    productInfo?.productionDate,
  ],
  ["Date / Shift", productInfo?.dateShift, "Expired Date", productInfo?.expiredDate],
  [
    "Prod Start",
    productInfo?.prodStart,
    "Hour Meter Start",
    productInfo?.hourMeterStart,
  ],
  [
    "Prod Stop",
    productInfo?.prodStop,
    "Hour Meter Stop",
    productInfo?.hourMeterStop,
  ],
  [
    "Carton Sucked Off",
    `${toDisplayText(productInfo?.cartonSuckedOff, "-")} pcs`,
    "Carton Filled",
    `${toDisplayText(productInfo?.cartonFilled, "-")} pcs`,
  ],
  [
    "Carton Diverted",
    `${toDisplayText(productInfo?.cartonDiverted, "-")} pcs`,
    "Carton Produced",
    `${toDisplayText(productInfo?.cartonProduced, "-")} pcs`,
  ],
];

const renderInformasiProdukDetailHtml = (record = {}) => {
  const payload = getPrimaryPayload(record);
  const productInfo =
    payload?.productInfo && typeof payload.productInfo === "object"
      ? payload.productInfo
      : {};
  const paperRows = Array.isArray(payload?.paperRows) ? payload.paperRows : [];
  const paperRowsForDisplay = paperRows.length > 0 ? paperRows : [{}];
  const productInfoRows = buildProductInfoRows(productInfo);

  return `
    <div style="margin-top:10px;">
      <h3 style="font-weight:700; background-color:#d9f0e3; padding:8px 10px; margin:15px 0 8px; font-size:12px; color:#2f5d43;">
        INFORMASI PRODUK
      </h3>
      <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:9px;">
        <tbody>
          ${productInfoRows
            .map(
              (row) => `
                <tr>
                  <th style="border:1px solid #ccc; padding:5px; text-align:left; background-color:#e7f2ed; width:22%;">
                    ${escapeHtml(row[0])}
                  </th>
                  <td style="border:1px solid #ccc; padding:5px; text-align:center; width:28%;">
                    ${escapeHtml(toDisplayText(row[1], "-"))}
                  </td>
                  <th style="border:1px solid #ccc; padding:5px; text-align:left; background-color:#e7f2ed; width:22%;">
                    ${escapeHtml(row[2])}
                  </th>
                  <td style="border:1px solid #ccc; padding:5px; text-align:center; width:28%;">
                    ${escapeHtml(toDisplayText(row[3], "-"))}
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>

      <h3 style="font-weight:700; background-color:#d9f0e3; padding:8px 10px; margin:15px 0 8px; font-size:12px; color:#2f5d43;">
        PAPER AKLIMATISASI
      </h3>
      <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:8px; border:1px solid #666;">
        <tbody>
          ${paperRowsForDisplay
            .map(
              (row, index) => `
                <tr>
                  <td style="width:36px; border:1px solid #8a8a8a; text-align:center; font-weight:700; vertical-align:middle;">
                    ${index + 1}
                  </td>
                  ${PAPER_GROUPS.map(
                    (group) => `
                      <td style="width:24%; border:1px solid #8a8a8a; padding:0; vertical-align:top;">
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #b3b3b3; padding:2px 6px; min-height:18px;">
                          <span style="font-weight:600; color:#1f1f1f;">Box No</span>
                          <span style="color:#222; margin-left:8px;">${escapeHtml(
                            toDisplayText(row?.[group.box], "-")
                          )}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #b3b3b3; padding:2px 6px; min-height:18px;">
                          <span style="font-weight:600; color:#1f1f1f;">Start Date</span>
                          <span style="color:#222; margin-left:8px;">${escapeHtml(
                            toDisplayText(row?.[group.date], "-")
                          )}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:2px 6px; min-height:18px;">
                          <span style="font-weight:600; color:#1f1f1f;">Start Time</span>
                          <span style="color:#222; margin-left:8px;">${escapeHtml(
                            toDisplayText(row?.[group.time], "-")
                          )}</span>
                        </div>
                      </td>
                    `
                  ).join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

module.exports = { renderInformasiProdukDetailHtml };
