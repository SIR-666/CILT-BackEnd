const { escapeHtml, toDisplayText } = require("./rendererShared");
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
      (hasMeaningfulValue(row.shift) ||
        hasMeaningfulValue(row.var) ||
        hasMeaningfulValue(row.jumlah))
  );
  const totalWarehouse = sumNumeric(rows, "jumlah");

  return `
    <div style="margin-top:10px;">
      <h3 style="font-weight:700; background-color:#dcfce7; color:#166534; padding:8px 12px; margin:15px 0 8px; font-size:11px; text-align:center;">
        INFORMASI MESIN
      </h3>
      <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:10px;">
        <tbody>
          <tr>
            <th style="width:120px; border:1px solid #333; padding:6px 10px; text-align:left; background-color:#f3f4f6; color:#374151; font-weight:600;">
              Mesin / Line
            </th>
            <td style="border:1px solid #333; padding:6px 10px; text-align:left;">
              ${escapeHtml(toDisplayText(formData?.mesinLine, "-"))}
            </td>
          </tr>
          <tr>
            <th style="width:120px; border:1px solid #333; padding:6px 10px; text-align:left; background-color:#f3f4f6; color:#374151; font-weight:600;">
              Kode Prod.
            </th>
            <td style="border:1px solid #333; padding:6px 10px; text-align:left;">
              ${escapeHtml(toDisplayText(formData?.kodeProd, "-"))}
            </td>
          </tr>
          <tr>
            <th style="width:120px; border:1px solid #333; padding:6px 10px; text-align:left; background-color:#f3f4f6; color:#374151; font-weight:600;">
              Kode Expire
            </th>
            <td style="border:1px solid #333; padding:6px 10px; text-align:left;">
              ${escapeHtml(toDisplayText(formData?.kodeExpire, "-"))}
            </td>
          </tr>
        </tbody>
      </table>

      <h3 style="font-weight:700; background-color:#dcfce7; color:#166534; padding:8px 12px; margin:15px 0 8px; font-size:11px; text-align:center;">
        DATA INSPEKSI
      </h3>
      <table style="width:100%; border-collapse:collapse; margin:8px 0; font-size:10px;">
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
              .map(
                (label) => `
                  <th style="border:1px solid #333; padding:5px 3px; text-align:center; font-size:9px; font-weight:700; background-color:rgb(14, 197, 75); color:#fff;">
                    ${escapeHtml(label)}
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
                  <td colspan="13" style="border:1px solid #333; padding:6px 4px; text-align:center;">
                    No data
                  </td>
                </tr>
              `
              : rows
                  .map(
                    (row, idx) => `
                      <tr>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${idx + 1}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.shift, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.var, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.iprp, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.lclexp, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.vol, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.palletNo, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.cartonNo, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.ctn, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.jam, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.jumlah, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center;">${escapeHtml(
                          toDisplayText(row?.keterangan, "-")
                        )}</td>
                        <td style="border:1px solid #333; padding:6px 4px; text-align:center; font-size:9px; color:#555;">
                          ${escapeHtml(toDisplayText(row?.user, "-"))}<br />
                          ${escapeHtml(toDisplayText(row?.time, "-"))}
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
    </div>
  `;
};

module.exports = { renderRobotPalletizerFillerDetailHtml };
