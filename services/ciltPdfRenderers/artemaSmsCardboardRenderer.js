const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const {
  hasMeaningfulValue,
  resolvePrimaryPayload,
} = require("./packageRendererUtils");

const renderProductInfoTable = (infoRows = []) => `
  <table class="v2-table">
    <tbody>
      ${infoRows
        .map(
          (row) => `
            <tr>
              <td class="left" style="font-weight:700; background:#e7f2ed; width:120px;">
                ${escapeHtml(row[0])}
              </td>
              <td class="left">${escapeHtml(toDisplayText(row[1]))}</td>
              <td class="left" style="font-weight:700; background:#e7f2ed; width:120px;">
                ${escapeHtml(row[2])}
              </td>
              <td class="left">${escapeHtml(toDisplayText(row[3]))}</td>
            </tr>
          `
        )
        .join("")}
    </tbody>
  </table>
`;

const renderTempTable = (tempHoseData = [], startIndex, title) => {
  const tankRow = Array.isArray(tempHoseData[0]) ? tempHoseData[0] : [];
  return `
    <div style="margin-bottom:10px;">
      <p style="font-size:12px; color:#666; margin:8px 0; font-style:italic;">${escapeHtml(
        title
      )}</p>
      <table class="v2-table">
        <thead>
          <tr>
            <th style="width:80px;">TEMP</th>
            ${Array.from({ length: 6 }, (_, idx) => `<th>JAM ${startIndex + idx + 1}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="center" style="font-weight:700; background:#f8faf9;">TANK</td>
            ${Array.from(
              { length: 6 },
              (_, idx) =>
                `<td class="center">${escapeHtml(
                  toDisplayText(tankRow[startIndex + idx]?.tank, "")
                )}</td>`
            ).join("")}
          </tr>
          ${[1, 2, 3, 4]
            .map((rowIndex) => {
              const row = Array.isArray(tempHoseData[rowIndex]) ? tempHoseData[rowIndex] : [];
              return `
                <tr>
                  <td class="center" style="font-weight:700; background:#f8faf9;">${rowIndex}</td>
                  ${Array.from(
                    { length: 6 },
                    (_, idx) =>
                      `<td class="center">${escapeHtml(
                        `${toDisplayText(row[startIndex + idx]?.hose, "")} / ${toDisplayText(
                          row[startIndex + idx]?.ndl,
                          ""
                        )}`
                      )}</td>`
                  ).join("")}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const renderSimpleRowsTable = ({
  title,
  columns = [],
  rows = [],
  maxWidth = "",
}) => `
  <p class="section-title">${escapeHtml(title)}</p>
  <table class="v2-table" ${maxWidth ? `style="max-width:${maxWidth};"` : ""}>
    <thead>
      <tr>
        ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${
        rows.length === 0
          ? renderV2EmptyRow({ colspan: columns.length })
          : rows
              .map(
                (row) => `
                  <tr>
                    ${columns
                      .map((column) => {
                        const key = column
                          .toLowerCase()
                          .replace(/\s+/g, "")
                          .replace(/\./g, "");
                        return `<td class="center">${escapeHtml(
                          toDisplayText(
                            row?.[key] ??
                              row?.[column] ??
                              row?.[column.charAt(0).toLowerCase() + column.slice(1)]
                          )
                        )}</td>`;
                      })
                      .join("")}
                  </tr>
                `
              )
              .join("")
      }
    </tbody>
  </table>
`;

const renderArtemaSmsCardboardDetailHtml = (record = {}) => {
  const payload = resolvePrimaryPayload(record);
  const tempHoseData = Array.isArray(payload?.tempHoseData) ? payload.tempHoseData : [];
  const glueData = (Array.isArray(payload?.glueData) ? payload.glueData : []).filter(
    (row) => row && (hasMeaningfulValue(row.jam) || hasMeaningfulValue(row.qtyKg))
  );
  const lossData = (Array.isArray(payload?.lossData) ? payload.lossData : []).filter(
    (row) =>
      row &&
      (hasMeaningfulValue(row.namaProduk) || hasMeaningfulValue(row.carton) || hasMeaningfulValue(row.paper))
  );
  const problemData = (Array.isArray(payload?.problemData) ? payload.problemData : []).filter(
    (row) =>
      row &&
      (hasMeaningfulValue(row.stop) || hasMeaningfulValue(row.start) || hasMeaningfulValue(row.masalah))
  );

  const infoRows = [
    ["Nama Produk", payload?.namaProduk, "Kode Produksi", payload?.kodeProduksi],
    ["Line MC", payload?.lineMc, "Kode Kadaluwarsa", payload?.kodeKadaluwarsa],
    ["Hours Stop", payload?.hoursStop, "Start Produksi", payload?.startProduksi],
    ["Hours Start", payload?.hoursStart, "Stop Produksi", payload?.stopProduksi],
  ];

  return `
    <p class="section-title">LAPORAN ARTEMA &amp; SMS CARDBOARD</p>
    <p class="section-title">INFORMASI PRODUK</p>
    ${renderProductInfoTable(infoRows)}
    <p class="section-title">PEMERIKSAAN TEMPERATURE HOSE (KELIPATAN 3 JAM)</p>
    ${renderTempTable(tempHoseData, 0, "Jam 1-6")}
    ${renderTempTable(tempHoseData, 6, "Jam 7-12")}
    ${renderSimpleRowsTable({
      title: "PENAMBAHAN GLUE",
      columns: ["No", "Jam", "QtyKg"],
      rows: glueData.map((row, index) => ({ No: index + 1, Jam: row.jam, QtyKg: row.qtyKg })),
      maxWidth: "450px",
    })}
    ${renderSimpleRowsTable({
      title: "LOSS CARTON & PAPER",
      columns: ["NamaProduk", "Carton", "Paper"],
      rows: lossData.map((row) => ({
        NamaProduk: row.namaProduk,
        Carton: row.carton,
        Paper: row.paper,
      })),
      maxWidth: "550px",
    })}
    ${renderSimpleRowsTable({
      title: "PROBLEM SAAT PRODUKSI",
      columns: ["Stop", "Start", "Durasi", "Masalah", "CorrectiveAction", "Pic"],
      rows: problemData.map((row) => ({
        Stop: row.stop,
        Start: row.start,
        Durasi: row.durasi,
        Masalah: row.masalah,
        CorrectiveAction: row.correctiveAction,
        Pic: row.pic,
      })),
    })}
    ${
      hasMeaningfulValue(payload?.catatan)
        ? `
          <div style="background:#f8f9fa; padding:12px; border-radius:6px; border-left:4px solid #2e7d32; margin-top:15px; font-size:12px;">
            <strong>CATATAN:</strong> ${escapeHtml(toDisplayText(payload?.catatan))}
          </div>
        `
        : ""
    }
  `;
};

module.exports = { renderArtemaSmsCardboardDetailHtml };
