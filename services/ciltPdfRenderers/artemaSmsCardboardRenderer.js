const { escapeHtml, toDisplayText } = require("./rendererShared");
const {
  hasMeaningfulValue,
  resolvePrimaryPayload,
} = require("./packageRendererUtils");

const renderPrintSectionTitle = (title) => `
  <h3 style="font-weight:700; background-color:#d9f0e3; padding:10px 15px; margin:18px 0 10px; border-radius:6px; color:#2f5d43; font-size:14px; text-align:center; border:1px solid #b8d4c2;">
    ${escapeHtml(title)}
  </h3>
`;

const renderPrintTempTable = (tempHoseData = [], startIndex = 0, title = "") => {
  const tankRow = Array.isArray(tempHoseData[0]) ? tempHoseData[0] : [];
  return `
    <div>
      <p style="font-size:12px; color:#666; margin:8px 0; font-style:italic;">
        ${escapeHtml(title)}
      </p>
      <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:80px;">
              TEMP
            </th>
            ${Array.from({ length: 6 }, (_, idx) => startIndex + idx + 1)
              .map(
                (hourNumber) => `
                  <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#d7e9dd; min-width:70px;">
                    JAM ${hourNumber}
                  </th>
                `
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #bbb; padding:10px 8px; text-align:center; font-weight:700; background-color:#f8faf9;">
              TANK
            </td>
            ${Array.from({ length: 6 }, (_, idx) => startIndex + idx)
              .map(
                (hourIndex) => `
                  <td style="border:1px solid #bbb; padding:8px 6px; text-align:center;">
                    ${escapeHtml(toDisplayText(tankRow[hourIndex]?.tank, "-"))}
                  </td>
                `
              )
              .join("")}
          </tr>
          ${[1, 2, 3, 4]
            .map((rowIndex) => {
              const row = Array.isArray(tempHoseData[rowIndex]) ? tempHoseData[rowIndex] : [];
              return `
                <tr>
                  <td style="border:1px solid #bbb; padding:10px 8px; text-align:center; font-weight:700; background-color:#f8faf9;">
                    ${rowIndex}
                  </td>
                  ${Array.from({ length: 6 }, (_, idx) => startIndex + idx)
                    .map(
                      (hourIndex) => `
                        <td style="border:1px solid #bbb; padding:8px 6px; text-align:center;">
                          ${escapeHtml(
                            `${toDisplayText(row[hourIndex]?.hose, "-")} / ${toDisplayText(
                              row[hourIndex]?.ndl,
                              "-"
                            )}`
                          )}
                        </td>
                      `
                    )
                    .join("")}
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
};

const renderArtemaSmsCardboardDetailHtml = (record = {}) => {
  const payload = resolvePrimaryPayload(record);
  const tempHoseData = Array.isArray(payload?.tempHoseData) ? payload.tempHoseData : [];
  const glueData = (Array.isArray(payload?.glueData) ? payload.glueData : []).filter(
    (row) => row && (hasMeaningfulValue(row.jam) || hasMeaningfulValue(row.qtyKg))
  );
  const lossData = (Array.isArray(payload?.lossData) ? payload.lossData : []).filter(
    (row) =>
      row &&
      (hasMeaningfulValue(row.namaProduk) ||
        hasMeaningfulValue(row.carton) ||
        hasMeaningfulValue(row.paper))
  );
  const problemData = (Array.isArray(payload?.problemData) ? payload.problemData : []).filter(
    (row) =>
      row &&
      (hasMeaningfulValue(row.stop) ||
        hasMeaningfulValue(row.start) ||
        hasMeaningfulValue(row.masalah))
  );

  const infoRows = [
    ["Nama Produk", payload?.namaProduk, "Kode Produksi", payload?.kodeProduksi],
    ["Line MC", payload?.lineMc, "Kode Kadaluwarsa", payload?.kodeKadaluwarsa],
    ["Hours Stop", payload?.hoursStop, "Start Produksi", payload?.startProduksi],
    ["Hours Start", payload?.hoursStart, "Stop Produksi", payload?.stopProduksi],
  ];

  return `
    <div style="margin-top:10px;">
      ${renderPrintSectionTitle("INFORMASI PRODUK")}
      <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">
        <tbody>
          ${infoRows
            .map(
              (row) => `
                <tr>
                  <th style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:12px; background-color:#e7f2ed; width:120px;">
                    ${escapeHtml(row[0])}
                  </th>
                  <td style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:12px;">
                    ${escapeHtml(toDisplayText(row[1], "-"))}
                  </td>
                  <th style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:12px; background-color:#e7f2ed; width:120px;">
                    ${escapeHtml(row[2])}
                  </th>
                  <td style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:12px;">
                    ${escapeHtml(toDisplayText(row[3], "-"))}
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>

      ${renderPrintSectionTitle("PEMERIKSAAN TEMPERATURE HOSE (KELIPATAN 3 JAM)")}
      ${renderPrintTempTable(tempHoseData, 0, "Jam 1-6")}
      ${renderPrintTempTable(tempHoseData, 6, "Jam 7-12")}

      ${renderPrintSectionTitle("PENAMBAHAN GLUE")}
      <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px; max-width:450px;">
        <thead>
          <tr>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:15%;">NO</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:42%;">JAM</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:43%;">QTY (KG)</th>
          </tr>
        </thead>
        <tbody>
          ${
            glueData.length === 0
              ? `
                <tr>
                  <td colspan="3" style="border:1px solid #bbb; padding:10px 8px; text-align:center; color:#999; font-style:italic;">
                    No data
                  </td>
                </tr>
              `
              : glueData
                  .map(
                    (row, idx) => `
                      <tr>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${idx + 1}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.jam, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.qtyKg, "-")
                        )}</td>
                      </tr>
                    `
                  )
                  .join("")
          }
        </tbody>
      </table>

      ${renderPrintSectionTitle("LOSS CARTON & PAPER")}
      <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px; max-width:550px;">
        <thead>
          <tr>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:40%;">NAMA PRODUK</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:30%;">CARTON</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:30%;">PAPER</th>
          </tr>
        </thead>
        <tbody>
          ${
            lossData.length === 0
              ? `
                <tr>
                  <td colspan="3" style="border:1px solid #bbb; padding:10px 8px; text-align:center; color:#999; font-style:italic;">
                    No data
                  </td>
                </tr>
              `
              : lossData
                  .map(
                    (row) => `
                      <tr>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:12px;">${escapeHtml(
                          toDisplayText(row?.namaProduk, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.carton, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.paper, "-")
                        )}</td>
                      </tr>
                    `
                  )
                  .join("")
          }
        </tbody>
      </table>

      ${renderPrintSectionTitle("PROBLEM SAAT PRODUKSI")}
      <table style="width:100%; border-collapse:collapse; margin:10px 0; font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed;">STOP</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed;">START</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed;">DURASI</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:20%;">MASALAH</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed; width:20%;">Corrective Action</th>
            <th style="border:1px solid #bbb; padding:10px 8px; text-align:center; background-color:#e7f2ed;">PIC</th>
          </tr>
        </thead>
        <tbody>
          ${
            problemData.length === 0
              ? `
                <tr>
                  <td colspan="6" style="border:1px solid #bbb; padding:10px 8px; text-align:center; color:#999; font-style:italic;">
                    No data
                  </td>
                </tr>
              `
              : problemData
                  .map(
                    (row) => `
                      <tr>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.stop, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.start, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.durasi, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:10px;">${escapeHtml(
                          toDisplayText(row?.masalah, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:left; padding-left:10px;">${escapeHtml(
                          toDisplayText(row?.correctiveAction, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:10px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.pic, "-")
                        )}</td>
                      </tr>
                    `
                  )
                  .join("")
          }
        </tbody>
      </table>

      ${
        hasMeaningfulValue(payload?.catatan)
          ? `
            <div style="background-color:#f8f9fa; padding:12px; border-radius:6px; border-left:4px solid #2e7d32; margin-top:15px; font-size:12px;">
              <strong>CATATAN:</strong> ${escapeHtml(toDisplayText(payload?.catatan, "-"))}
            </div>
          `
          : ""
      }
    </div>
  `;
};

module.exports = { renderArtemaSmsCardboardDetailHtml };
