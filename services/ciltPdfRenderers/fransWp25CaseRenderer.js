const { escapeHtml, toDisplayText } = require("./rendererShared");
const {
  hasMeaningfulValue,
  resolvePrimaryPayload,
  sumNumeric,
} = require("./packageRendererUtils");

const renderPrintSectionTitle = (title) => `
  <h3 style="font-weight:700; background:linear-gradient(90deg, #c8e6c9 0%, #e8f5e9 100%); padding:8px 12px; margin:15px 0 8px; border-radius:4px; color:#1b5e20; font-size:12px; border-left:4px solid #2e7d32;">
    ${escapeHtml(title)}
  </h3>
`;

const renderPrintFransHoseTable = ({
  headerTN = [],
  hoseTable = [],
  hoseRowLabels = [],
  startIndex = 0,
  title = "",
}) => `
  <div>
    <p style="font-style:italic; font-size:9px; color:#666; margin:0 0 5px; padding-left:5px;">
      ${escapeHtml(title)}
    </p>
    <table style="width:100%; border-collapse:collapse; margin:8px 0 15px; font-size:10px;">
      <thead>
        <tr>
          <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9; width:150px;">
            TEMP (°C)
          </th>
          ${Array.from({ length: 6 }, (_, idx) => startIndex + idx + 1)
            .map(
              (hourNumber) => `
                <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">
                  Jam ${hourNumber}
                </th>
              `
            )
            .join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="border:1px solid #bbb; padding:6px 8px; text-align:left; font-weight:700; background-color:#f8faf8;">
            Header T/N
          </td>
          ${Array.from({ length: 6 }, (_, idx) => startIndex + idx)
            .map((hourIndex) => {
              const value = headerTN[hourIndex] || {};
              return `
                <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">
                  ${escapeHtml(
                    `${toDisplayText(value?.T, "-")} / ${toDisplayText(
                      value?.N,
                      "-"
                    )}`
                  )}
                </td>
              `;
            })
            .join("")}
        </tr>
        ${hoseRowLabels
          .map((label, rowIndex) => {
            const row = Array.isArray(hoseTable[rowIndex]) ? hoseTable[rowIndex] : [];
            return `
              <tr>
                <td style="border:1px solid #bbb; padding:6px 8px; text-align:left; font-weight:700; background-color:#f8faf8;">
                  ${escapeHtml(label)}
                </td>
                ${Array.from({ length: 6 }, (_, idx) => startIndex + idx)
                  .map(
                    (hourIndex) => `
                      <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">
                        ${escapeHtml(
                          `${toDisplayText(row[hourIndex]?.hose, "-")} / ${toDisplayText(
                            row[hourIndex]?.nozzle,
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

const renderFransWp25CaseDetailHtml = (record = {}) => {
  const payload = resolvePrimaryPayload(record);
  const hoseTable = Array.isArray(payload?.hoseTable) ? payload.hoseTable : [];
  const headerTN = Array.isArray(payload?.headerTN) ? payload.headerTN : [];
  const glueData = (Array.isArray(payload?.glueData) ? payload.glueData : []).filter(
    (row) => row && (hasMeaningfulValue(row.jam) || hasMeaningfulValue(row.qty))
  );
  const ncData = (Array.isArray(payload?.ncData) ? payload.ncData : []).filter(
    (row) =>
      row &&
      (hasMeaningfulValue(row.stop) ||
        hasMeaningfulValue(row.start) ||
        hasMeaningfulValue(row.masalah))
  );
  const totalQty = sumNumeric(glueData, "qty");

  const infoRows = [
    ["Nama Produk", payload?.namaProduk, "Kode Produksi", payload?.kodeProduksi],
    ["Rasa", payload?.rasa, "Kode Kadaluwarsa", payload?.kodeKadaluwarsa],
    ["Line MC", payload?.lineMc, "Start Produksi", payload?.startProduksi],
    ["Air Supply", payload?.airSupply, "Stop Produksi", payload?.stopProduksi],
    ["Hours Start", payload?.hoursStart, "Hours Stop", payload?.hoursStop],
  ];
  const hoseRowLabels = [
    "1. Tank/Nozzle",
    "2. Tank/Nozzle",
    "3. Tank/Nozzle",
    "4. Tank/Nozzle",
  ];

  return `
    <div style="margin-top:10px;">
      ${renderPrintSectionTitle("INFORMASI PRODUK")}
      <table style="width:100%; border-collapse:collapse; margin:8px 0 15px; font-size:10px;">
        <tbody>
          ${infoRows
            .map(
              (row) => `
                <tr>
                  <th style="border:1px solid #bbb; padding:6px 8px; text-align:left; background-color:#e8f5e9; width:140px;">
                    ${escapeHtml(row[0])}
                  </th>
                  <td style="border:1px solid #bbb; padding:6px 8px; text-align:left;">
                    ${escapeHtml(toDisplayText(row[1], "-"))}
                  </td>
                  <th style="border:1px solid #bbb; padding:6px 8px; text-align:left; background-color:#e8f5e9; width:140px;">
                    ${escapeHtml(row[2])}
                  </th>
                  <td style="border:1px solid #bbb; padding:6px 8px; text-align:left;">
                    ${escapeHtml(toDisplayText(row[3], "-"))}
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>

      ${renderPrintSectionTitle("PEMERIKSAAN TEMPERATURE HOSE (KELIPATAN 3 JAM)")}
      ${renderPrintFransHoseTable({
        headerTN,
        hoseTable,
        hoseRowLabels,
        startIndex: 0,
        title: "Jam 1-6",
      })}
      ${renderPrintFransHoseTable({
        headerTN,
        hoseTable,
        hoseRowLabels,
        startIndex: 6,
        title: "Jam 7-12",
      })}

      ${renderPrintSectionTitle("PENAMBAHAN GLUE")}
      <p style="font-style:italic; font-size:9px; color:#666; margin:0 0 5px; padding-left:5px;">
        Dilakukan setiap 700 CTN (± 1 jam), Penambahan glue 1 kg
      </p>
      <table style="width:100%; border-collapse:collapse; margin:8px 0 15px; font-size:10px; max-width:460px;">
        <thead>
          <tr>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9; width:15%;">NO</th>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9; width:42%;">JAM</th>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9; width:43%;">QTY (KG)</th>
          </tr>
        </thead>
        <tbody>
          ${
            glueData.length === 0
              ? `
                <tr>
                  <td colspan="3" style="border:1px solid #bbb; padding:6px 8px; text-align:center; color:#999; font-style:italic;">
                    No data
                  </td>
                </tr>
              `
              : `
                ${glueData
                  .map(
                    (row, idx) => `
                      <tr>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${idx + 1}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.jam, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.qty, "-")
                        )}</td>
                      </tr>
                    `
                  )
                  .join("")}
                <tr>
                  <td colspan="2" style="border:1px solid #bbb; padding:6px 8px; text-align:center; font-weight:700; background-color:#f5f9f5;">
                    TOTAL
                  </td>
                  <td style="border:1px solid #bbb; padding:6px 8px; text-align:center; font-weight:700; background-color:#f5f9f5;">
                    ${escapeHtml(totalQty.toFixed(1))} kg
                  </td>
                </tr>
              `
          }
        </tbody>
      </table>

      ${renderPrintSectionTitle("CATATAN KETIDAKSESUAIAN SELAMA PROSES PRODUKSI")}
      <table style="width:100%; border-collapse:collapse; margin:8px 0 15px; font-size:10px;">
        <thead>
          <tr>
            <th colspan="3" style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">
              Waktu (menit)
            </th>
            <th rowspan="2" style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9; width:18%;">
              Masalah
            </th>
            <th rowspan="2" style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9; width:18%;">
              Tindakan Koreksi
            </th>
            <th rowspan="2" style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">
              PIC
            </th>
            <th colspan="2" style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">
              Loss
            </th>
          </tr>
          <tr>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">Stop</th>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">Start</th>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">Durasi</th>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">Pack</th>
            <th style="border:1px solid #bbb; padding:6px 8px; text-align:center; background-color:#e8f5e9;">Karton</th>
          </tr>
        </thead>
        <tbody>
          ${
            ncData.length === 0
              ? `
                <tr>
                  <td colspan="8" style="border:1px solid #bbb; padding:6px 8px; text-align:center; color:#999; font-style:italic;">
                    No data
                  </td>
                </tr>
              `
              : ncData
                  .map(
                    (row) => `
                      <tr>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.stop, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.start, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.durasi, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:left; padding-left:10px;">${escapeHtml(
                          toDisplayText(row?.masalah, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:left; padding-left:10px;">${escapeHtml(
                          toDisplayText(row?.corrective, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.pic, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.lossPack, "-")
                        )}</td>
                        <td style="border:1px solid #bbb; padding:6px 8px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.lossKarton, "-")
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

module.exports = { renderFransWp25CaseDetailHtml };
