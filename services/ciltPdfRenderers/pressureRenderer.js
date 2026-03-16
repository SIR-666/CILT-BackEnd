const { escapeHtml, toDisplayText } = require("./rendererShared");
const {
  getPrintShiftHourSlots,
  resolvePrimaryPayload,
  normalizeText,
} = require("./packageRendererUtils");

const renderPressureValue = (value) => escapeHtml(toDisplayText(value, "-"));

const renderPressureTable = ({
  title,
  rows = [],
  hourSlots = [],
  parameterColumnWidth = 30,
  slotColumnWidth = 7.5,
  mode = "jam",
}) => `
  <div style="margin-bottom:18px; break-inside:auto; page-break-inside:auto;">
    <h4 style="margin:0 0 6px; text-align:center; font-weight:700; font-size:14px; color:#111827;">
      ${escapeHtml(title)}
    </h4>
    <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:11px;">
      <thead>
        <tr>
          <th style="width:${parameterColumnWidth}%; padding:4px 6px; text-align:center; border:0.5px solid #000; background:#f2f2f2; color:#000; font-weight:700;">
            Parameter
          </th>
          ${hourSlots
            .map(
              (slot) => `
                <th style="width:${slotColumnWidth}%; padding:4px 6px; text-align:center; border:0.5px solid #000; background:#f2f2f2; color:#000; font-weight:700;">
                  ${escapeHtml(slot.label)}
                </th>
              `
            )
            .join("")}
        </tr>
        ${
          mode === "pack"
            ? `
              <tr>
                <th style="padding:4px 6px; text-align:center; border:0.5px solid #000; background:#fafafa;"></th>
                ${hourSlots
                  .map(
                    () => `
                      <th style="padding:0; text-align:center; border:0.5px solid #000; background:#f7f7f7; font-weight:700;">
                        <div style="display:flex; width:100%; min-height:16px;">
                          <div style="flex:1; display:flex; align-items:center; justify-content:center; border-right:0.5px solid #000; font-size:10px; padding:1px 0;">:00</div>
                          <div style="flex:1; display:flex; align-items:center; justify-content:center; font-size:10px; padding:1px 0;">:30</div>
                        </div>
                      </th>
                    `
                  )
                  .join("")}
              </tr>
            `
            : ""
        }
      </thead>
      <tbody>
        ${
          !Array.isArray(rows) || rows.length === 0
            ? `
              <tr>
                <td colspan="${
                  1 + hourSlots.length
                }" style="padding:4px 6px; text-align:center; border:0.5px solid #000;">
                  No data
                </td>
              </tr>
            `
            : rows
                .map((param) => {
                  const values =
                    param?.values && typeof param.values === "object"
                      ? param.values
                      : {};
                  const parameterLabel = `${toDisplayText(param?.parameter_name)}${
                    normalizeText(param?.unit).trim()
                      ? ` (${toDisplayText(param?.unit)})`
                      : ""
                  }`;

                  return `
                    <tr>
                      <td style="padding:4px 6px; font-size:11px; border:0.5px solid #000; text-align:left; font-weight:700; line-height:1.2; word-break:break-word;">
                        ${escapeHtml(parameterLabel)}
                      </td>
                      ${hourSlots
                        .map((slot) => {
                          if (mode === "jam") {
                            return `
                              <td style="padding:4px 6px; font-size:11px; text-align:center; border:0.5px solid #000; height:18px;">
                                ${renderPressureValue(values[`jam${slot.key}`])}
                              </td>
                            `;
                          }

                          return `
                            <td style="padding:0; border:0.5px solid #000; height:18px;">
                              <div style="display:flex; width:100%; height:100%; min-height:16px;">
                                <div style="flex:1; display:flex; align-items:center; justify-content:center; border-right:0.5px solid #000; font-size:10px; padding:1px 0;">
                                  ${renderPressureValue(values[`p${slot.key}_1`])}
                                </div>
                                <div style="flex:1; display:flex; align-items:center; justify-content:center; font-size:10px; padding:1px 0;">
                                  ${renderPressureValue(values[`p${slot.key}_2`])}
                                </div>
                              </div>
                            </td>
                          `;
                        })
                        .join("")}
                    </tr>
                  `;
                })
                .join("")
        }
      </tbody>
    </table>
  </div>
`;

const renderPressureDetailHtml = (record = {}) => {
  const primaryPayload = resolvePrimaryPayload(record);
  const pressureCheck1Jam = Array.isArray(primaryPayload?.pressureCheck1Jam)
    ? primaryPayload.pressureCheck1Jam
    : [];
  const pressureCheck30Min = Array.isArray(primaryPayload?.pressureCheck30Min)
    ? primaryPayload.pressureCheck30Min
    : [];
  const hourSlots = getPrintShiftHourSlots(record?.shift);
  const parameterColumnWidth = hourSlots.length >= 9 ? 30 : 26;
  const slotColumnWidth = ((100 - parameterColumnWidth) / Math.max(hourSlots.length, 1)).toFixed(3);

  return `
    <div style="margin-top:10px;">
      ${renderPressureTable({
        title: "PENGECEKAN PRESSURE (1 JAM)",
        rows: pressureCheck1Jam,
        hourSlots,
        parameterColumnWidth,
        slotColumnWidth,
        mode: "jam",
      })}
      ${renderPressureTable({
        title: "PENGECEKAN PRESSURE (30 MENIT)",
        rows: pressureCheck30Min,
        hourSlots,
        parameterColumnWidth,
        slotColumnWidth,
        mode: "pack",
      })}
    </div>
  `;
};

module.exports = { renderPressureDetailHtml };
