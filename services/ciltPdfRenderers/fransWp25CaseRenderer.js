const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const {
  hasMeaningfulValue,
  resolvePrimaryPayload,
  sumNumeric,
} = require("./packageRendererUtils");

const renderInfoTable = (infoRows = []) => `
  <table class="v2-table">
    <tbody>
      ${infoRows
        .map(
          (row) => `
            <tr>
              <td class="left" style="font-weight:700; background:#e8f5e9; width:140px;">
                ${escapeHtml(row[0])}
              </td>
              <td class="left">${escapeHtml(toDisplayText(row[1]))}</td>
              <td class="left" style="font-weight:700; background:#e8f5e9; width:140px;">
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

const renderFransHoseTable = ({ hoseTable, headerTN, rowLabels, startIndex, title }) => `
  <div style="margin-bottom:10px;">
    <p style="font-style:italic; font-size:9px; color:#666; margin:0 0 5px; padding-left:5px;">
      ${escapeHtml(title)}
    </p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:150px;">TEMP (°C)</th>
          ${Array.from({ length: 6 }, (_, idx) => `<th>Jam ${startIndex + idx + 1}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="left" style="font-weight:700; background:#f8faf8;">Header T/N</td>
          ${Array.from({ length: 6 }, (_, idx) => {
            const value = headerTN[startIndex + idx] || {};
            return `<td class="center">${escapeHtml(
              `${toDisplayText(value?.T, "")} / ${toDisplayText(value?.N, "")}`
            )}</td>`;
          }).join("")}
        </tr>
        ${rowLabels
          .map((label, rowIndex) => {
            const row = Array.isArray(hoseTable[rowIndex]) ? hoseTable[rowIndex] : [];
            return `
              <tr>
                <td class="left" style="font-weight:700; background:#f8faf8;">${escapeHtml(
                  label
                )}</td>
                ${Array.from({ length: 6 }, (_, idx) => {
                  const cell = row[startIndex + idx] || {};
                  return `<td class="center">${escapeHtml(
                    `${toDisplayText(cell?.hose, "")} / ${toDisplayText(cell?.nozzle, "")}`
                  )}</td>`;
                }).join("")}
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  </div>
`;

const renderGlueTable = (glueRows = [], totalQty = 0) => `
  <table class="v2-table" style="max-width:460px;">
    <thead>
      <tr>
        <th style="width:15%;">NO</th>
        <th style="width:42%;">JAM</th>
        <th style="width:43%;">QTY (KG)</th>
      </tr>
    </thead>
    <tbody>
      ${
        glueRows.length === 0
          ? renderV2EmptyRow({ colspan: 3 })
          : `
            ${glueRows
              .map(
                (row, index) => `
                  <tr>
                    <td class="center">${index + 1}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.jam, ""))}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.qty, ""))}</td>
                  </tr>
                `
              )
              .join("")}
            <tr>
              <td class="center" colspan="2" style="font-weight:700; background:#f5f9f5;">TOTAL</td>
              <td class="center" style="font-weight:700; background:#f5f9f5;">
                ${escapeHtml(totalQty.toFixed(1))} kg
              </td>
            </tr>
          `
      }
    </tbody>
  </table>
`;

const renderNcTable = (rows = []) => `
  <table class="v2-table">
    <thead>
      <tr>
        <th colspan="3">Waktu (menit)</th>
        <th rowspan="2" style="width:18%;">Masalah</th>
        <th rowspan="2" style="width:18%;">Tindakan Koreksi</th>
        <th rowspan="2">PIC</th>
        <th colspan="2">Loss</th>
      </tr>
      <tr>
        <th>Stop</th>
        <th>Start</th>
        <th>Durasi</th>
        <th>Pack</th>
        <th>Karton</th>
      </tr>
    </thead>
    <tbody>
      ${
        rows.length === 0
          ? renderV2EmptyRow({ colspan: 8 })
          : rows
              .map(
                (row) => `
                  <tr>
                    <td class="center">${escapeHtml(toDisplayText(row?.stop, ""))}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.start, ""))}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.durasi, ""))}</td>
                    <td class="left">${escapeHtml(toDisplayText(row?.masalah, ""))}</td>
                    <td class="left">${escapeHtml(toDisplayText(row?.corrective, ""))}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.pic, ""))}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.lossPack, ""))}</td>
                    <td class="center">${escapeHtml(toDisplayText(row?.lossKarton, ""))}</td>
                  </tr>
                `
              )
              .join("")
      }
    </tbody>
  </table>
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
      (hasMeaningfulValue(row.stop) || hasMeaningfulValue(row.start) || hasMeaningfulValue(row.masalah))
  );
  const totalQty = sumNumeric(glueData, "qty");

  const infoRows = [
    ["Nama Produk", payload?.namaProduk, "Kode Produksi", payload?.kodeProduksi],
    ["Rasa", payload?.rasa, "Kode Kadaluwarsa", payload?.kodeKadaluwarsa],
    ["Line MC", payload?.lineMc, "Start Produksi", payload?.startProduksi],
    ["Air Supply", payload?.airSupply, "Stop Produksi", payload?.stopProduksi],
    ["Hours Start", payload?.hoursStart, "Hours Stop", payload?.hoursStop],
  ];
  const hoseRowLabels = ["1. Tank/Nozzle", "2. Tank/Nozzle", "3. Tank/Nozzle", "4. Tank/Nozzle"];

  return `
    <p class="section-title">LAPORAN FRANS WP 25 CASE</p>
    <p class="section-title">INFORMASI PRODUK</p>
    ${renderInfoTable(infoRows)}
    <p class="section-title">PEMERIKSAAN TEMPERATURE HOSE (KELIPATAN 3 JAM)</p>
    ${renderFransHoseTable({
      hoseTable,
      headerTN,
      rowLabels: hoseRowLabels,
      startIndex: 0,
      title: "Jam 1-6",
    })}
    ${renderFransHoseTable({
      hoseTable,
      headerTN,
      rowLabels: hoseRowLabels,
      startIndex: 6,
      title: "Jam 7-12",
    })}
    <p class="section-title">PENAMBAHAN GLUE</p>
    <p style="font-style:italic; font-size:9px; color:#666; margin:0 0 5px; padding-left:5px;">
      Dilakukan setiap 700 CTN (± 1 jam), Penambahan glue 1 kg
    </p>
    ${renderGlueTable(glueData, totalQty)}
    <p class="section-title">CATATAN KETIDAKSESUAIAN SELAMA PROSES PRODUKSI</p>
    ${renderNcTable(ncData)}
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

module.exports = { renderFransWp25CaseDetailHtml };
