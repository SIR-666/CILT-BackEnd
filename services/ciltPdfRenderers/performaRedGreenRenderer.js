const { escapeHtml, parseJsonArray, renderV2EmptyBlock, toDisplayText } = require("./rendererShared");

const getShiftHours = (shift) => {
  if (shift === "Shift 1") return [6, 7, 8, 9, 10, 11, 12, 13, 14];
  if (shift === "Shift 2") return [14, 15, 16, 17, 18, 19, 20, 21, 22];
  if (shift === "Shift 3") return [22, 23, 0, 1, 2, 3, 4, 5, 6];
  return [];
};

const parseHourLoose = (value) => {
  const match = String(value ?? "").match(/\b(\d{1,2})(?::\d{2})?\b/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const selectedHourFromInspection = (inspection = {}) => {
  const candidates = [
    inspection?.hourSlot,
    inspection?.hour_slot,
    inspection?.timeSlot,
    inspection?.time_slot,
    inspection?.hour,
    inspection?.selectedHour,
    inspection?.hourSelected,
  ];

  for (const candidate of candidates) {
    const hour = parseHourLoose(candidate);
    if (hour !== undefined) return hour;
  }
  return undefined;
};

const selectedHourFromRecord = (record = {}) => {
  const groupValue =
    record?.HourGroup ??
    record?.hourGroup ??
    record?.hour_slot ??
    record?.hourSlot ??
    record?.timeSlot ??
    record?.selectedHour ??
    record?.hour;
  const text = String(groupValue ?? "");
  const rangeMatch = text.match(/(\d{1,2})(?::\d{2})?\s*[-–]\s*(\d{1,2})/);
  if (rangeMatch) return Number(rangeMatch[1]);
  return parseHourLoose(text);
};

const normalizeSlot = (value) => {
  const match = String(value ?? "").match(/(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})/);
  if (!match) return undefined;
  const h1 = String(parseInt(match[1], 10)).padStart(2, "0");
  const m1 = match[2];
  const h2 = String(parseInt(match[3], 10)).padStart(2, "0");
  const m2 = match[4];
  return `${h1}:${m1} - ${h2}:${m2}`;
};

const parseCombinedInspections = (record = {}) => {
  const chunks = String(record?.CombinedInspectionData || "").match(/\[[\s\S]*?\]/g) || [];
  const output = [];
  for (const text of chunks) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) output.push(...parsed);
    } catch (error) {
      // Ignore malformed chunks.
    }
  }
  return output;
};

const isNonEmptyPerformaValue = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "" &&
  String(value).trim() !== "-";

const normalizeActivityKey = (activity) =>
  String(activity || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const resolvePeriode = (periode, hasTimeSlot = false) => {
  const normalized = String(periode || "").toLowerCase();
  if (hasTimeSlot || normalized.includes("30")) return "30 menit";
  return "Tiap Jam";
};

const buildActivityKey = (activity, periode) => {
  const periodKey = String(periode || "").toLowerCase().includes("30")
    ? "30min"
    : "hourly";
  return `${periodKey}|${normalizeActivityKey(activity)}`;
};

const parsePerformaRowsFromRecord = (record = {}, fallbackInspectionRows = null) => {
  const rowsFromInspection = Array.isArray(fallbackInspectionRows)
    ? fallbackInspectionRows
    : parseJsonArray(record?.inspectionData);
  const combinedRows = parseCombinedInspections(record);
  if (combinedRows.length > 0) return combinedRows;
  return rowsFromInspection;
};

const extractUniqueInspectionData = (records = [], fallbackInspectionRows = null) => {
  const uniqueActivities = {};
  const allActualTimes = {};
  const safeRecords = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === "object")
    .slice();

  const getRecordTimestamp = (record = {}) => {
    const candidates = [
      record?.submitTime,
      record?.submittedAt,
      record?.updatedAt,
      record?.createdAt,
      record?.date,
    ];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const parsed = new Date(String(candidate).replace(" ", "T"));
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    return 0;
  };

  safeRecords.sort((left, right) => getRecordTimestamp(left) - getRecordTimestamp(right));

  const ensureActivityRow = (raw = {}) => {
    const activityLabel = String(raw?.activity || "").trim();
    if (!activityLabel) return null;

    const resolvedPeriode = resolvePeriode(
      raw?.periode ?? raw?.frekuensi,
      !!(raw?.timeSlot || raw?.time_slot)
    );
    const key = buildActivityKey(activityLabel, resolvedPeriode);

    if (!uniqueActivities[key]) {
      uniqueActivities[key] = {
        activity: activityLabel,
        standard: raw?.standard || "",
        good: raw?.good ?? "-",
        need: raw?.need ?? "-",
        reject: raw?.reject ?? "-",
        periode: resolvedPeriode,
        results: {},
        results30: {},
        picture: {},
      };
    } else {
      if (!uniqueActivities[key].standard && raw?.standard) {
        uniqueActivities[key].standard = raw.standard;
      }
      if (
        (uniqueActivities[key].good === "-" || uniqueActivities[key].good === "") &&
        isNonEmptyPerformaValue(raw?.good)
      ) {
        uniqueActivities[key].good = raw.good;
      }
      if (
        (uniqueActivities[key].need === "-" || uniqueActivities[key].need === "") &&
        isNonEmptyPerformaValue(raw?.need)
      ) {
        uniqueActivities[key].need = raw.need;
      }
      if (
        (uniqueActivities[key].reject === "-" || uniqueActivities[key].reject === "") &&
        isNonEmptyPerformaValue(raw?.reject)
      ) {
        uniqueActivities[key].reject = raw.reject;
      }
    }

    return {
      key,
      isThirtyMinuteRow: resolvedPeriode === "30 menit",
    };
  };

  for (const record of safeRecords) {
    const inspections = parsePerformaRowsFromRecord(record, fallbackInspectionRows);
    if (!Array.isArray(inspections) || inspections.length === 0) continue;

    for (const inspection of inspections) {
      if (!inspection || typeof inspection !== "object" || Array.isArray(inspection)) continue;
      const rowInfo = ensureActivityRow(inspection);
      if (!rowInfo) continue;

      const { key, isThirtyMinuteRow } = rowInfo;
      const selectedHour =
        selectedHourFromInspection(inspection) ?? selectedHourFromRecord(record);

      if (isThirtyMinuteRow) {
        const slotKey = normalizeSlot(inspection.timeSlot || inspection.time_slot);
        if (slotKey && isNonEmptyPerformaValue(inspection.results)) {
          uniqueActivities[key].results30[slotKey] = String(inspection.results);
        }

        const slotHour = parseHourLoose(slotKey);
        const hourForTime = slotHour !== undefined ? slotHour : selectedHour;
        if (hourForTime !== undefined && inspection.time) {
          if (!allActualTimes[hourForTime]) allActualTimes[hourForTime] = new Set();
          const match = String(inspection.time).match(/(\d{1,2}):(\d{2})/);
          if (match) {
            const normalized = `${match[1].padStart(2, "0")}:${match[2]}`;
            allActualTimes[hourForTime].add(normalized);
          }
        }
        continue;
      }

      if (selectedHour !== undefined && isNonEmptyPerformaValue(inspection.results)) {
        uniqueActivities[key].results[selectedHour] = String(inspection.results);
        if (inspection.picture) uniqueActivities[key].picture[selectedHour] = inspection.picture;

        if (inspection.time) {
          if (!allActualTimes[selectedHour]) allActualTimes[selectedHour] = new Set();
          const match = String(inspection.time).match(/(\d{1,2}):(\d{2})/);
          if (match) {
            const normalized = `${match[1].padStart(2, "0")}:${match[2]}`;
            allActualTimes[selectedHour].add(normalized);
          }
        }
      }
    }
  }

  const actualTimesPerHour = {};
  Object.keys(allActualTimes).forEach((hour) => {
    actualTimesPerHour[hour] = Array.from(allActualTimes[hour]).sort();
  });

  return {
    activities: Object.values(uniqueActivities),
    actualTimesPerHour,
  };
};

const evaluateValue = (inputValue, goodCriteria, rejectCriteria) => {
  const numericValue = parseFloat(inputValue);
  if (Number.isNaN(numericValue)) return "default";

  const parseRange = (value) => {
    if (!value || value === "-") return null;
    const match = String(value).match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    return match
      ? { type: "range", min: parseFloat(match[1]), max: parseFloat(match[2]) }
      : null;
  };

  const parseRejectConditions = (value) => {
    if (!value || value === "-") return null;
    return String(value)
      .split("/")
      .map((token) => token.trim())
      .map((token) => {
        const match = token.match(/^(<=|>=|<|>)\s*(-?\d+(?:\.\d+)?)$/);
        return match ? { operator: match[1], value: parseFloat(match[2]) } : null;
      })
      .filter(Boolean);
  };

  const goodRange = parseRange(goodCriteria);
  const rejectConditions = parseRejectConditions(rejectCriteria);

  if (rejectConditions) {
    for (const condition of rejectConditions) {
      if (condition.operator === "<" && numericValue < condition.value) return "reject";
      if (condition.operator === ">" && numericValue > condition.value) return "reject";
      if (condition.operator === ">=" && numericValue >= condition.value) return "reject";
      if (condition.operator === "<=" && numericValue <= condition.value) return "reject";
    }
  }

  if (goodRange && numericValue >= goodRange.min && numericValue <= goodRange.max) {
    return "good";
  }

  return "need";
};

const getResultColor = (result, good, reject) => {
  if (["G", "N", "R"].includes(result)) {
    if (result === "G") return "bg-green-100 text-green-800";
    if (result === "N") return "bg-yellow-100 text-yellow-800";
    if (result === "R") return "bg-red-100 text-red-800";
  }
  const evaluated = evaluateValue(result, good, reject);
  if (evaluated === "good") return "bg-green-100 text-green-800";
  if (evaluated === "need") return "bg-yellow-100 text-yellow-800";
  if (evaluated === "reject") return "bg-red-100 text-red-800";
  return "bg-gray-50 text-gray-600";
};

const resolveResultClass = (value, row) => {
  if (!value || String(value).trim() === "-") {
    return "prg-val-empty";
  }
  const token = getResultColor(value, row?.good, row?.reject);
  if (token.includes("bg-green-100")) {
    return "prg-val-good";
  }
  if (token.includes("bg-yellow-100")) {
    return "prg-val-need";
  }
  if (token.includes("bg-red-100")) {
    return "prg-val-reject";
  }
  return "prg-val-default";
};

const normalizeActivityName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");

const sortPerformaActivities = (rows = []) => {
  const pinnedLastActivities = [
    "beratgram",
    "speed<7000",
    "jumlahproduksipack",
    "rejectpack",
  ];

  return (Array.isArray(rows) ? rows : []).slice().sort((left, right) => {
    const leftKey = normalizeActivityName(left?.activity);
    const rightKey = normalizeActivityName(right?.activity);
    const leftPinnedIndex = pinnedLastActivities.findIndex((token) =>
      leftKey.includes(token)
    );
    const rightPinnedIndex = pinnedLastActivities.findIndex((token) =>
      rightKey.includes(token)
    );

    const leftPinned = leftPinnedIndex !== -1;
    const rightPinned = rightPinnedIndex !== -1;
    if (leftPinned && rightPinned) return leftPinnedIndex - rightPinnedIndex;
    if (leftPinned) return 1;
    if (rightPinned) return -1;
    return 0;
  });
};

const renderPerformaRedGreenDetailHtml = (record = {}, inspectionRows = null) => {
  const shiftHours = getShiftHours(toDisplayText(record?.shift, ""));
  const extracted = extractUniqueInspectionData(
    [{ ...record, inspectionData: inspectionRows ?? record?.inspectionData }],
    inspectionRows
  );
  const sortedRows = sortPerformaActivities(extracted.activities);
  const actualTimes = extracted.actualTimesPerHour || {};

  if (shiftHours.length === 0) {
    return renderV2EmptyBlock();
  }

  const renderActualTimeHeaders = shiftHours
    .map((hour) => {
      const related = actualTimes?.[hour] || actualTimes?.[String(hour)] || [];
      if (!Array.isArray(related) || related.length === 0) {
        return `
          <th class="prg-actual-col">
            <span class="prg-actual-empty">-</span>
          </th>
        `;
      }

      return `
        <th class="prg-actual-col">
          <div class="prg-actual-stack">
            ${related
              .map(
                (timeStr) => `
                  <span class="prg-actual-badge">
                    ${escapeHtml(toDisplayText(timeStr, "-"))}
                  </span>
                `
              )
              .join("")}
          </div>
        </th>
      `;
    })
    .join("");

  const renderHourHeaders = shiftHours
    .map(
      (hour) => `
        <th class="prg-h-hour">
          ${escapeHtml(String(hour).padStart(2, "0"))}:00
        </th>
      `
    )
    .join("");

  const bodyRows =
    sortedRows.length === 0
      ? `
        <tr>
          <td class="prg-empty-row" colspan="${5 + shiftHours.length}">
            No inspection data available
          </td>
        </tr>
      `
      : sortedRows
          .map((row, rowIndex) => {
            const isStriped = rowIndex % 2 !== 0;
            const hourCells = shiftHours
              .map((hour) => {
                const isThirtyMinuteRow = String(row?.periode || "")
                  .toLowerCase()
                  .includes("30");
                const hourLabel = String(hour).padStart(2, "0");
                const nextHourLabel = String((hour + 1) % 24).padStart(2, "0");
                const slot1 = normalizeSlot(`${hourLabel}:00 - ${hourLabel}:30`);
                const slot2 = normalizeSlot(`${hourLabel}:30 - ${nextHourLabel}:00`);

                if (isThirtyMinuteRow) {
                  const value1 = slot1 ? row.results30?.[slot1] ?? "" : "";
                  const value2 = slot2 ? row.results30?.[slot2] ?? "" : "";
                  const className1 = resolveResultClass(value1, row);
                  const className2 = resolveResultClass(value2, row);
                  return `
                    <td class="prg-half-cell">
                      <div class="prg-half-grid">
                        <div class="prg-half prg-half-left ${className1}">
                          ${escapeHtml(toDisplayText(value1, "-"))}
                        </div>
                        <div class="prg-half ${className2}">
                          ${escapeHtml(toDisplayText(value2, "-"))}
                        </div>
                      </div>
                    </td>
                  `;
                }

                const value =
                  row.results?.[hour] ??
                  row.results?.[Number(hour)] ??
                  row.results?.[`${hourLabel}:00`] ??
                  "";
                const className = resolveResultClass(value, row);
                return `
                  <td class="prg-val ${className}">
                    ${escapeHtml(toDisplayText(value, "-"))}
                  </td>
                `;
              })
              .join("");

            return `
              <tr${isStriped ? ' class="prg-row-alt"' : ""}>
                <td class="prg-static prg-no">${rowIndex + 1}</td>
                <td class="prg-static prg-activity">
                  ${escapeHtml(toDisplayText(row.activity, "-"))}
                  ${
                    String(row?.periode || "").toLowerCase().includes("30")
                      ? '<span class="prg-pill">30 Menit</span>'
                      : ""
                  }
                </td>
                <td class="prg-static prg-score">${escapeHtml(
                  toDisplayText(row.good, "-")
                )}</td>
                <td class="prg-static prg-score">${escapeHtml(
                  toDisplayText(row.need, "-")
                )}</td>
                <td class="prg-static prg-score">${escapeHtml(
                  toDisplayText(row.reject, "-")
                )}</td>
                ${hourCells}
              </tr>
            `;
          })
          .join("");

  return `
    <div class="prg-wrap">
      <div class="prg-legend">
        <span class="prg-legend-item">
          <span class="prg-legend-swatch prg-legend-swatch--good"></span>
          Good (G)
        </span>
        <span class="prg-legend-item">
          <span class="prg-legend-swatch prg-legend-swatch--need"></span>
          Need Attention (N)
        </span>
        <span class="prg-legend-item">
          <span class="prg-legend-swatch prg-legend-swatch--reject"></span>
          Reject (R)
        </span>
      </div>

      <div class="prg-panel">
        <table class="prg-table">
          <thead>
            <tr>
              <th class="prg-h-actual" colspan="5">
                Actual Time
              </th>
              ${renderActualTimeHeaders}
            </tr>
            <tr>
              <th class="prg-h-no">No</th>
              <th class="prg-h-activity">Activity</th>
              <th class="prg-h-score">G</th>
              <th class="prg-h-score">N</th>
              <th class="prg-h-score">R</th>
              ${renderHourHeaders}
            </tr>
          </thead>
          <tbody>
            ${bodyRows}
          </tbody>
        </table>
      </div>

      <div class="prg-summary">
        <div class="prg-summary-title">Summary</div>
        <div class="prg-summary-grid">
          <div>Total Activities: ${sortedRows.length}</div>
          <div>Shift Hours: ${shiftHours.length} hours</div>
          <div>Total Records: 1</div>
        </div>
      </div>
    </div>
  `;
};

module.exports = { renderPerformaRedGreenDetailHtml };
