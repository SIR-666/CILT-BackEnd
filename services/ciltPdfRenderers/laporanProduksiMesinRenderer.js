const {
  escapeHtml,
  parseJsonArray,
  renderV2EmptyBlock,
  toDisplayText,
} = require("./rendererShared");

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
  return inspectionRows.find(
    (row) => row && typeof row === "object" && !Array.isArray(row)
  ) || {};
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
    return {
      label: "-",
      color: "#6b7280",
      background: "#ffffff",
    };
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
      color: isOk ? "#166534" : "#b91c1c",
      background: isOk ? "#dcfce7" : "#fee2e2",
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
      color: isOk ? "#166534" : "#b91c1c",
      background: isOk ? "#dcfce7" : "#fee2e2",
    };
  }

  return {
    label: "-",
    color: "#6b7280",
    background: "#ffffff",
  };
};

const renderMachineSectionTable = ({
  titlePrefix,
  sectionName,
  sectionRows = [],
  values = {},
  payloadPage = 1,
}) => {
  const hourHeaders = COMBI_XG_HOUR_OPTIONS.map(
    (hour) => `<th style="width:42px;">${escapeHtml(hour)}:00</th>`
  ).join("");

  const bodyRows = sectionRows
    .map((paramItem) => {
      const rangeHint = buildRangeHint(paramItem);
      const parameterCell = `
        <td class="left" style="min-width:180px;">
          <div>${escapeHtml(toDisplayText(paramItem?.parameter_name))}</div>
          ${
            rangeHint
              ? `<div style="margin-top:2px; font-size:9px; color:#6b7280;">${escapeHtml(
                  rangeHint
                )}</div>`
              : ""
          }
        </td>
      `;

      const hourCells = COMBI_XG_HOUR_OPTIONS.map((hour) => {
        const resolved = resolveItemValue(values, paramItem, hour, payloadPage, {
          strictHour: true,
        });
        const status = evaluateStatus(paramItem, resolved.statusValue);
        return `
          <td class="center" style="background:${status.background};">
            <div>${escapeHtml(toDisplayText(resolved.displayValue))}</div>
            <div style="margin-top:2px; color:${status.color}; font-weight:700;">${escapeHtml(
              status.label
            )}</div>
          </td>
        `;
      }).join("");

      return `<tr>${parameterCell}${hourCells}</tr>`;
    })
    .join("");

  return `
    <p class="section-title">${escapeHtml(titlePrefix)} - ${escapeHtml(sectionName)}</p>
    <table class="v2-table" style="font-size:8.2px;">
      <thead>
        <tr>
          <th style="min-width:180px; text-align:left;">Parameter</th>
          ${hourHeaders}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
};

const renderMachineSections = ({ record = {}, titlePrefix }) => {
  const payload = getPrimaryPayload(record);
  const grouped = buildGroupedSections(payload);
  const values =
    payload?.values && typeof payload.values === "object" ? payload.values : {};
  const payloadPage = normalizePageNumber(payload?.page, 1);
  const sections = Object.keys(grouped);

  if (sections.length === 0) {
    return renderV2EmptyBlock();
  }

  return sections
    .map((sectionName) =>
      renderMachineSectionTable({
        titlePrefix,
        sectionName,
        sectionRows: Array.isArray(grouped[sectionName]) ? grouped[sectionName] : [],
        values,
        payloadPage,
      })
    )
    .join("\n");
};

const renderLaporanProduksiMesinDetailHtml = (record = {}) =>
  renderMachineSections({
    record,
    titlePrefix: "MACHINE CHECK PARAMETERS",
  });

module.exports = {
  renderLaporanProduksiMesinDetailHtml,
};
