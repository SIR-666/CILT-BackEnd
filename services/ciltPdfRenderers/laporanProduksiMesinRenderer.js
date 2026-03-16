const { escapeHtml, parseJsonArray, toDisplayText } = require("./rendererShared");

const COMBI_XG_HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0")
);

const normalizePageNumber = (value, fallback = 1) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
};

const buildHourValueKey = (id, hour, pageNumber) =>
  `${id}__p_${normalizePageNumber(pageNumber)}__h_${hour}`;

const buildLegacyHourValueKey = (id, hour) => `${id}__h_${hour}`;

const resolveItemValue = (
  values = {},
  paramItem = {},
  selectedHour = null,
  payloadPage = 1,
  options = {}
) => {
  const normalize = (value) => String(value ?? "").trim();
  const strictHour = Boolean(options?.strictHour);
  const legacy = normalize(values?.[paramItem?.id]);
  const resolvedPage = normalizePageNumber(paramItem?.page, payloadPage);

  const slotKey = selectedHour
    ? buildHourValueKey(paramItem?.id, selectedHour, resolvedPage)
    : "";
  const legacySlotKey = selectedHour
    ? buildLegacyHourValueKey(paramItem?.id, selectedHour)
    : "";
  const selectedValue = normalize(values?.[slotKey] ?? values?.[legacySlotKey] ?? "");

  if (selectedValue) {
    return { displayValue: selectedValue, statusValue: selectedValue };
  }

  if (strictHour) {
    return { displayValue: legacy || "-", statusValue: legacy };
  }

  for (const hour of COMBI_XG_HOUR_OPTIONS) {
    const hourlyValue = normalize(
      values?.[buildHourValueKey(paramItem?.id, hour, resolvedPage)] ??
        values?.[buildLegacyHourValueKey(paramItem?.id, hour)] ??
        ""
    );
    if (hourlyValue) {
      return {
        displayValue: `${hour}:00 = ${hourlyValue}`,
        statusValue: hourlyValue,
      };
    }
  }

  return { displayValue: legacy || "-", statusValue: legacy };
};

const getPrimaryPayload = (record = {}) => {
  const inspectionRows = parseJsonArray(record?.inspectionData);
  return (
    inspectionRows.find(
      (row) => row && typeof row === "object" && !Array.isArray(row)
    ) || {}
  );
};

const buildGroupedSections = (payload = {}) => {
  const grouped =
    payload?.grouped && typeof payload.grouped === "object" ? payload.grouped : {};
  if (Object.keys(grouped).length > 0) return grouped;

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.reduce((accumulator, row) => {
    const sectionName = String(row?.section || "LAINNYA");
    if (!accumulator[sectionName]) accumulator[sectionName] = [];
    accumulator[sectionName].push(row);
    return accumulator;
  }, {});
};

const buildRangeHint = (paramItem = {}) =>
  paramItem?.range_text ||
  (paramItem?.value_type === "range" &&
  paramItem?.min_value !== null &&
  paramItem?.min_value !== undefined &&
  paramItem?.max_value !== null &&
  paramItem?.max_value !== undefined
    ? `${paramItem.min_value} - ${paramItem.max_value} ${paramItem?.unit || ""}`.trim()
    : paramItem?.value_type === "exact" &&
      paramItem?.exact_value !== null &&
      paramItem?.exact_value !== undefined
    ? `Exact ${paramItem.exact_value} ${paramItem?.unit || ""}`.trim()
    : "");

const evaluateStatus = (paramItem = {}, rawValue) => {
  const parsedValue = parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) {
    return { label: "-", statusColor: "#666", cellBg: "#fff" };
  }

  if (
    paramItem?.value_type === "range" &&
    paramItem?.min_value !== null &&
    paramItem?.min_value !== undefined &&
    paramItem?.max_value !== null &&
    paramItem?.max_value !== undefined
  ) {
    const isOk = parsedValue >= paramItem.min_value && parsedValue <= paramItem.max_value;
    return {
      label: isOk ? "OK" : "NOT OK",
      statusColor: isOk ? "#2e7d32" : "#d32f2f",
      cellBg: isOk ? "#e8f5e9" : "#ffebee",
    };
  }

  if (
    paramItem?.value_type === "exact" &&
    paramItem?.exact_value !== null &&
    paramItem?.exact_value !== undefined
  ) {
    const isOk = parsedValue === paramItem.exact_value;
    return {
      label: isOk ? "OK" : "NOT OK",
      statusColor: isOk ? "#2e7d32" : "#d32f2f",
      cellBg: isOk ? "#e8f5e9" : "#ffebee",
    };
  }

  return { label: "-", statusColor: "#666", cellBg: "#fff" };
};

const renderMachineSectionTable = ({
  sectionName,
  sectionRows = [],
  values = {},
  payloadPage = 1,
}) => {
  const machineHours = COMBI_XG_HOUR_OPTIONS;
  const isDenseMachineHourTable = machineHours.length >= 20;
  const machineParamColumnPercent = isDenseMachineHourTable ? 16 : 22;
  const machineHourColumnPercent =
    (100 - machineParamColumnPercent) / Math.max(machineHours.length, 1);
  const machinePrintFontSize = isDenseMachineHourTable ? "6.2px" : "8px";

  return `
    <div style="margin-bottom:10px;">
      <div style="font-weight:700; background-color:#eef5ef; padding:6px 8px; margin:10px 0 5px; border-left:3px solid #2e7d32; font-size:10px;">
        ${escapeHtml(toDisplayText(sectionName, "-"))}
      </div>
      <div>
        <table style="border-collapse:collapse; margin:8px 0; font-size:${machinePrintFontSize}; width:100%; table-layout:fixed;">
          <thead>
            <tr>
              <th style="border:1px solid #ccc; padding:3px; text-align:left; background-color:#e7f2ed; width:${machineParamColumnPercent}%;">
                Parameter
              </th>
              ${machineHours
                .map(
                  (hour) => `
                    <th style="border:1px solid #ccc; padding:3px 1px; text-align:center; background-color:#e7f2ed; width:${machineHourColumnPercent}%; white-space:nowrap;">
                      ${escapeHtml(hour)}:00
                    </th>
                  `
                )
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${sectionRows
              .map((paramItem) => {
                const rangeHint = buildRangeHint(paramItem);
                return `
                  <tr>
                    <td style="border:1px solid #ccc; padding:3px; text-align:left; vertical-align:top; word-break:break-word;">
                      <div>${escapeHtml(toDisplayText(paramItem?.parameter_name, "-"))}</div>
                      ${
                        rangeHint
                          ? `<small style="color:#777; line-height:1.2;">${escapeHtml(rangeHint)}</small>`
                          : ""
                      }
                    </td>
                    ${machineHours
                      .map((hour) => {
                        const resolved = resolveItemValue(
                          values,
                          paramItem,
                          hour,
                          payloadPage,
                          { strictHour: true }
                        );
                        const status = evaluateStatus(paramItem, resolved.statusValue);
                        return `
                          <td style="border:1px solid #ccc; padding:3px 1px; text-align:center; background-color:${status.cellBg}; vertical-align:top;">
                            <div>${escapeHtml(toDisplayText(resolved.displayValue, "-"))}</div>
                            <div style="margin-top:2px; font-weight:700; color:${status.statusColor};">
                              ${escapeHtml(toDisplayText(status.label, "-"))}
                            </div>
                          </td>
                        `;
                      })
                      .join("")}
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const renderMachineSections = ({ record = {} }) => {
  const payload = getPrimaryPayload(record);
  const grouped = buildGroupedSections(payload);
  const values =
    payload?.values && typeof payload.values === "object" ? payload.values : {};
  const payloadPage = normalizePageNumber(payload?.page, 1);
  const sections = Object.keys(grouped);

  return `
    <div style="margin-top:10px;">
      <h3 style="font-weight:700; background-color:#d9f0e3; padding:8px 10px; margin:15px 0 8px; font-size:12px; color:#2f5d43;">
        MACHINE CHECK PARAMETERS
      </h3>
      ${
        sections.length === 0
          ? '<p style="text-align:center; color:#666; font-size:10px;">No machine check data</p>'
          : sections
              .map((sectionName) =>
                renderMachineSectionTable({
                  sectionName,
                  sectionRows: Array.isArray(grouped[sectionName]) ? grouped[sectionName] : [],
                  values,
                  payloadPage,
                })
              )
              .join("")
      }
    </div>
  `;
};

const renderLaporanProduksiMesinDetailHtml = (record = {}) =>
  renderMachineSections({ record });

module.exports = {
  renderLaporanProduksiMesinDetailHtml,
};
