const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const {
  hasMeaningfulValue,
  resolvePrimaryPayload,
  sumNumeric,
} = require("./packageRendererUtils");

const renderRobotPalletizerFillerDetailHtml = (record = {}) => {
  const payload = resolvePrimaryPayload(record);
  const formData =
    payload?.formData && typeof payload.formData === "object" ? payload.formData : {};
  const rows = (Array.isArray(payload?.rows) ? payload.rows : []).filter(
    (row) =>
      row &&
      (hasMeaningfulValue(row.shift) || hasMeaningfulValue(row.var) || hasMeaningfulValue(row.jumlah))
  );
  const totalWarehouse = sumNumeric(rows, "jumlah");

  return `
    <p class="section-title">ROBOT PALLETIZER FILLER</p>
    <p class="section-title">INFORMASI MESIN</p>
    <table class="v2-table" style="max-width:520px;">
      <tbody>
        <tr>
          <td class="left" style="width:120px; font-weight:600; background:#f3f4f6;">Mesin / Line</td>
          <td class="left">${escapeHtml(toDisplayText(formData?.mesinLine))}</td>
        </tr>
        <tr>
          <td class="left" style="width:120px; font-weight:600; background:#f3f4f6;">Kode Prod.</td>
          <td class="left">${escapeHtml(toDisplayText(formData?.kodeProd))}</td>
        </tr>
        <tr>
          <td class="left" style="width:120px; font-weight:600; background:#f3f4f6;">Kode Expire</td>
          <td class="left">${escapeHtml(toDisplayText(formData?.kodeExpire))}</td>
        </tr>
      </tbody>
    </table>
    <p class="section-title">DATA INSPEKSI</p>
    <table class="v2-table" style="font-size:9.5px;">
      <thead>
        <tr>
          ${[
            "No",
            "Shift",
            "VAR",
            "IP/RP",
            "LCL/EXP",
            "Vol",
            "Pallet No",
            "Carton No",
            "CTN",
            "Jam",
            "Jumlah",
            "Keterangan",
            "User/Time",
          ]
            .map((label) => `<th>${escapeHtml(label)}</th>`)
            .join("")}
        </tr>
      </thead>
      <tbody>
        ${
          rows.length === 0
            ? renderV2EmptyRow({ colspan: 13 })
            : rows
                .map(
                  (row, index) => `
                    <tr>
                      <td class="center">${index + 1}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.shift, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.var, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.iprp, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.lclexp, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.vol, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.palletNo, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.cartonNo, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.ctn, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.jam, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.jumlah, ""))}</td>
                      <td class="center">${escapeHtml(toDisplayText(row?.keterangan, ""))}</td>
                      <td class="center" style="font-size:9px; color:#555;">
                        ${escapeHtml(toDisplayText(row?.user, ""))}<br/>
                        ${escapeHtml(toDisplayText(row?.time, ""))}
                      </td>
                    </tr>
                  `
                )
                .join("")
        }
      </tbody>
    </table>
    <div style="background:#dcfce7; padding:15px; border-radius:8px; margin-top:15px; border:1px solid #bbf7d0; text-align:center;">
      <div style="font-size:12px; font-weight:700; color:#166534; margin-bottom:8px;">
        JUMLAH YANG DITERIMA WAREHOUSE
      </div>
      <div style="font-size:24px; font-weight:700; color:#166534;">
        ${escapeHtml(String(totalWarehouse))}
      </div>
    </div>
  `;
};

module.exports = { renderRobotPalletizerFillerDetailHtml };
