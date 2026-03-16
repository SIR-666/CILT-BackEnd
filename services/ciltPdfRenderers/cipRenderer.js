const {
  parseJsonArray,
  toDisplayText,
  escapeHtml,
  renderV2EmptyRow,
} = require("./rendererShared");

const normalizeCipSteps = (record = {}) => {
  const steps = parseJsonArray(record?.steps || record?.cip_steps || record?.stepsData);
  return steps
    .filter((step) => step && typeof step === "object" && !Array.isArray(step))
    .map((step, index) => ({
      no: step?.no ?? index + 1,
      stepName: toDisplayText(
        step?.stepName ?? step?.step_name ?? step?.stepType ?? step?.step_type
      ),
      target: toDisplayText(step?.target ?? step?.targetValue ?? step?.tempMin),
      actual: toDisplayText(step?.actual ?? step?.actualValue ?? step?.tempActual),
      duration: toDisplayText(step?.duration ?? step?.time),
    }));
};

const normalizeCipSpecialRecords = (record = {}) => {
  const copRecords = parseJsonArray(record?.copRecords || record?.cop_records);
  const specialRecords = parseJsonArray(record?.specialRecords || record?.special_records);
  return [...copRecords, ...specialRecords]
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry) => ({
      type: toDisplayText(entry?.stepType ?? entry?.step_type ?? entry?.type),
      temp: toDisplayText(entry?.tempActual ?? entry?.temp_actual),
      conc: toDisplayText(entry?.concActual ?? entry?.conc_actual),
      start: toDisplayText(entry?.startTime ?? entry?.start_time),
      end: toDisplayText(entry?.endTime ?? entry?.end_time),
    }));
};

const renderCipContentHtml = (record = {}) => {
  const steps = normalizeCipSteps(record);
  const specials = normalizeCipSpecialRecords(record);
  const stepRows =
    steps.length > 0
      ? steps
          .map(
            (row) => `
              <tr>
                <td class="center">${escapeHtml(toDisplayText(row.no))}</td>
                <td class="left">${escapeHtml(row.stepName)}</td>
                <td class="center">${escapeHtml(row.target)}</td>
                <td class="center">${escapeHtml(row.actual)}</td>
                <td class="center">${escapeHtml(row.duration)}</td>
              </tr>
            `
          )
          .join("")
      : renderV2EmptyRow({ colspan: 5, cellClass: "v2-empty" });

  const specialRows =
    specials.length > 0
      ? specials
          .map(
            (row) => `
              <tr>
                <td class="left">${escapeHtml(row.type)}</td>
                <td class="center">${escapeHtml(row.temp)}</td>
                <td class="center">${escapeHtml(row.conc)}</td>
                <td class="center">${escapeHtml(row.start)}</td>
                <td class="center">${escapeHtml(row.end)}</td>
              </tr>
            `
          )
          .join("")
      : renderV2EmptyRow({ colspan: 5, cellClass: "v2-empty" });

  return `
    <p class="cip-title">CIP Type: ${escapeHtml(toDisplayText(record?.cipType || record?.cip_type))}</p>
    <p class="cip-line">Posisi: ${escapeHtml(toDisplayText(record?.posisi))}</p>
    <p class="cip-line">Operator: ${escapeHtml(toDisplayText(record?.operator))}</p>
    <p class="cip-line">Status: ${escapeHtml(toDisplayText(record?.status))}</p>
    <p class="cip-line">Flow Rate: ${escapeHtml(
      toDisplayText(record?.flowRate || record?.flow_rate, "")
    )}</p>
    <p class="cip-line">Flow Rate D/BC: ${escapeHtml(
      `${toDisplayText(record?.flowRateD || record?.flow_rate_d, "")} / ${toDisplayText(
        record?.flowRateBC || record?.flow_rate_bc,
        ""
      )}`
    )}</p>
    <p class="cip-section-title">CIP Steps</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:8%;">No</th>
          <th style="width:40%; text-align:left;">Step</th>
          <th style="width:17%;">Target</th>
          <th style="width:17%;">Actual</th>
          <th style="width:18%;">Duration</th>
        </tr>
      </thead>
      <tbody>${stepRows}</tbody>
    </table>
    <p class="cip-section-title">Special Records</p>
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:32%; text-align:left;">Type</th>
          <th style="width:17%;">Temp</th>
          <th style="width:17%;">Conc</th>
          <th style="width:17%;">Start</th>
          <th style="width:17%;">End</th>
        </tr>
      </thead>
      <tbody>${specialRows}</tbody>
    </table>
  `;
};

module.exports = { renderCipContentHtml };
