const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");
const {
  getPrintShiftHourSlots,
  resolvePrimaryPayload,
  normalizeText,
} = require("./packageRendererUtils");

const renderPressureValue = (value) => escapeHtml(toDisplayText(value, ""));

const renderPressureHeader = ({ title, hourSlots, parameterColumnWidth, slotColumnWidth, mode }) => `
  <h4 style="margin:0 0 6px; text-align:center; font-weight:700; font-size:14px; color:#111827;">
    ${escapeHtml(title)}
  </h4>
  <table class="v2-table" style="table-layout:fixed; font-size:11px;">
    <thead>
      <tr>
        <th style="width:${parameterColumnWidth}%;">Parameter</th>
        ${hourSlots
          .map(
            (slot) => `
              <th style="width:${slotColumnWidth}%;">
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
              <th style="background:#fafafa;"></th>
              ${hourSlots
                .map(
                  () => `
                    <th style="padding:0; background:#f7f7f7;">
                      <div style="display:flex; width:100%; min-height:16px;">
                        <div style="flex:1; border-right:0.5px solid #000; font-size:10px; padding:1px 0;">:00</div>
                        <div style="flex:1; font-size:10px; padding:1px 0;">:30</div>
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
`;

const renderPressureBody = ({ rows, hourSlots, mode }) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return `
      <tbody>
        ${renderV2EmptyRow({ colspan: 1 + hourSlots.length })}
      </tbody>
    `;
  }

  return `
    <tbody>
      ${safeRows
        .map((param) => {
          const values =
            param?.values && typeof param.values === "object" ? param.values : {};
          const parameterLabel = `${toDisplayText(param?.parameter_name)}${
            normalizeText(param?.unit).trim() ? ` (${toDisplayText(param?.unit)})` : ""
          }`;

          const valueCells = hourSlots
            .map((slot) => {
              if (mode === "jam") {
                return `
                  <td class="center">
                    ${renderPressureValue(values[`jam${slot.key}`])}
                  </td>
                `;
              }

              return `
                <td style="padding:0;">
                  <div style="display:flex; width:100%; min-height:16px;">
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
            .join("");

          return `
            <tr>
              <td class="left" style="font-weight:700; line-height:1.2;">
                ${escapeHtml(parameterLabel)}
              </td>
              ${valueCells}
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
};

const renderPressureTable = ({
  title,
  rows,
  hourSlots,
  parameterColumnWidth,
  slotColumnWidth,
  mode,
}) => `
  <div style="margin-bottom:18px;">
    ${renderPressureHeader({
      title,
      hourSlots,
      parameterColumnWidth,
      slotColumnWidth,
      mode,
    })}
    ${renderPressureBody({ rows, hourSlots, mode })}
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
    <p class="section-title">PENGECEKAN PRESSURE</p>
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
  `;
};

module.exports = { renderPressureDetailHtml };
