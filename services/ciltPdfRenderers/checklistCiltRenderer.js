const { escapeHtml, renderV2EmptyBlock, toDisplayText } = require("./rendererShared");

const hasMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const isTimeOnlyText = (value) =>
  /^\d{1,2}:\d{2}$/.test(String(value ?? "").trim());

const toChecklistDate = (value, anchorDate = null) => {
  if (!value && !anchorDate) return null;
  if (!value && anchorDate) {
    const anchored = new Date(anchorDate);
    return Number.isNaN(anchored.getTime()) ? null : anchored;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    if (!anchorDate) return null;
    const anchored = new Date(anchorDate);
    return Number.isNaN(anchored.getTime()) ? null : anchored;
  }

  if (isTimeOnlyText(text)) {
    const anchor = anchorDate ? new Date(anchorDate) : null;
    if (!anchor || Number.isNaN(anchor.getTime())) return null;
    const [hourPart, minutePart] = text.split(":");
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    anchor.setHours(hour, minute, 0, 0);
    return anchor;
  }

  const ymdDateTime = text.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/
  );
  if (ymdDateTime) {
    const [, year, month, day, hour = "00", minute = "00", second = "00"] = ymdDateTime;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const dmyDateTime = text.match(
    /^(\d{2})\/(\d{2})\/(\d{2,4})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (dmyDateTime) {
    const [, day, month, yearRaw, hour = "00", minute = "00", second = "00"] = dmyDateTime;
    const year = yearRaw.length === 2 ? Number(`20${yearRaw}`) : Number(yearRaw);
    const parsed = new Date(
      year,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(text.replace(" ", "T"));
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const getChecklistEntryDay = (entryTime, anchorDateLike) => {
  const anchor = toChecklistDate(anchorDateLike);
  if (!anchor) return null;
  if (!entryTime || isTimeOnlyText(entryTime)) return anchor.getDate();
  const parsed = toChecklistDate(entryTime, anchor);
  return parsed ? parsed.getDate() : anchor.getDate();
};

const isChecklistSameMonth = (entryTime, anchorDateLike) => {
  const anchor = toChecklistDate(anchorDateLike);
  if (!anchor) return true;
  if (!entryTime || isTimeOnlyText(entryTime)) return true;
  const parsed = toChecklistDate(entryTime, anchor);
  if (!parsed) return true;
  return (
    parsed.getFullYear() === anchor.getFullYear() &&
    parsed.getMonth() === anchor.getMonth()
  );
};

const getChecklistShiftFromTime = (entryTime, fallbackShift) => {
  const fallbackText = String(fallbackShift ?? "").toLowerCase();
  if (fallbackText.includes("1")) return 1;
  if (fallbackText.includes("2")) return 2;
  if (fallbackText.includes("3")) return 3;

  if (!entryTime) return null;
  const parsed = toChecklistDate(entryTime);
  if (!parsed) return null;
  const hour = parsed.getHours();
  if (hour >= 6 && hour < 14) return 1;
  if (hour >= 14 && hour < 22) return 2;
  return 3;
};

const resolveChecklistResultTone = (raw) => {
  const text = String(raw ?? "").trim();
  if (!text) {
    return {
      label: "",
      toneClass: "ck-tone-empty",
    };
  }

  const lowered = text.toLowerCase();
  if (["g", "ok"].includes(lowered) || lowered.includes("ok")) {
    return {
      label: lowered.includes("not ok") ? "NOT OK" : "OK",
      toneClass: lowered.includes("not ok") ? "ck-tone-not-ok" : "ck-tone-ok",
    };
  }

  if (
    lowered.includes("not ok") ||
    lowered.includes("not-ok") ||
    lowered.includes("ng") ||
    lowered === "r"
  ) {
    return {
      label: "NOT OK",
      toneClass: "ck-tone-not-ok",
    };
  }

  if (lowered === "n" || lowered.includes("need")) {
    return {
      label: "NEED",
      toneClass: "ck-tone-need",
    };
  }

  return {
    label: text,
    toneClass: "ck-tone-need",
  };
};

const splitChecklistRowsForPrint = (
  rows = [],
  firstChunkSize = 10,
  nextChunkSize = 16
) => {
  const chunks = [];
  let cursor = 0;
  let activeChunkSize = Math.max(1, firstChunkSize);
  while (cursor < rows.length) {
    chunks.push(rows.slice(cursor, cursor + activeChunkSize));
    cursor += activeChunkSize;
    activeChunkSize = Math.max(1, nextChunkSize);
  }
  return chunks;
};

const renderShiftSlot = (entry, shiftNumber, isLastSlot = false) => {
  const tone = resolveChecklistResultTone(entry?.result);
  return `
    <div class="ck-slot ${isLastSlot ? "" : "ck-slot--mid"} ${
      entry ? "ck-slot--active" : "ck-slot--faded"
    } ${tone.toneClass}">
      <span class="ck-slot-label">
        ${shiftNumber}
      </span>
      <span class="ck-badge">${escapeHtml(toDisplayText(tone.label, ""))}</span>
    </div>
  `;
};

const renderShiftBadge = (shiftNumber, active, isLast = false) => {
  const shiftClass = shiftNumber === 1 ? "ck-shift-1" : shiftNumber === 2 ? "ck-shift-2" : "ck-shift-3";
  return `
    <div class="ck-slot ${isLast ? "" : "ck-slot--mid"} ${
      active ? "ck-slot--active" : "ck-slot--faded"
    } ${shiftClass}">
      <span class="ck-slot-label">${shiftNumber}</span>
    </div>
  `;
};

const renderLayerTable = (layer, layerIndex, monthLabel) => {
  const dayCount = layer.endDay - layer.startDay + 1;
  const dayColumnWidth = `${48 / Math.max(dayCount, 1)}%`;
  const rowChunks = splitChecklistRowsForPrint(
    layer.rows,
    layerIndex === 0 ? 10 : 16,
    16
  );

  return `
    <div class="ck-layer" style="margin-top:${layerIndex === 0 ? "0" : "14px"};">
      <div class="ck-layer-title">
        ${escapeHtml(monthLabel)} - Tanggal ${escapeHtml(layer.label)}
      </div>
      ${rowChunks
        .map((chunkRows, chunkIndex) => {
          const shouldPageBreak = chunkIndex > 0 || layerIndex > 0;
          return `
            <div class="ck-chunk ${shouldPageBreak ? "ck-chunk--page-break" : ""}" style="margin-top:${
              chunkIndex === 0 ? "0" : "8px"
            };">
              <table class="ck-table">
                <thead>
                  <tr>
                    <th class="ck-head" style="width:5%;">No</th>
                    <th class="ck-head" style="width:14%;">Job Type</th>
                    <th class="ck-head" style="width:14%;">Component</th>
                    <th class="ck-head" style="width:4%;">Picture</th>
                    <th class="ck-head" style="width:9%;">User</th>
                    <th class="ck-head" style="width:6%;">Shift</th>
                    ${Array.from({ length: dayCount }, (_, offset) => layer.startDay + offset)
                      .map(
                        (day) => `
                          <th class="ck-head-day" style="width:${dayColumnWidth};">
                            ${day}
                          </th>
                        `
                      )
                      .join("")}
                  </tr>
                </thead>
                <tbody>
                  ${chunkRows
                    .map(
                      (row) => `
                        <tr>
                          <td class="ck-cell-center">
                            ${row.rowNumber}
                          </td>
                          <td class="ck-cell-padded">
                            ${escapeHtml(toDisplayText(row.jobType, "-"))}
                          </td>
                          <td class="ck-cell-padded">
                            ${escapeHtml(toDisplayText(row.component, "-"))}
                          </td>
                          <td class="ck-cell-center">N/A</td>
                          <td class="ck-user">
                            ${escapeHtml(toDisplayText(row.latestUser, "-"))}
                          </td>
                          <td class="ck-shift-col">
                            <div class="ck-stack">
                              ${renderShiftBadge(1, row.shiftsSeen[1])}
                              ${renderShiftBadge(2, row.shiftsSeen[2])}
                              ${renderShiftBadge(3, row.shiftsSeen[3], true)}
                            </div>
                          </td>
                          ${row.dayCells
                            .map(
                              (daySlot) => `
                                <td class="ck-day-col">
                                  ${renderShiftSlot(daySlot[1], 1)}
                                  ${renderShiftSlot(daySlot[2], 2)}
                                  ${renderShiftSlot(daySlot[3], 3, true)}
                                </td>
                              `
                            )
                            .join("")}
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderChecklistTableHtml = (rows = [], options = {}) => {
  const checklistRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => row && typeof row === "object" && !Array.isArray(row)
  );
  const anchorDateLike = options?.date || null;
  const monthDate = toChecklistDate(anchorDateLike) || new Date();
  const monthLabel = `${monthDate.toLocaleString("en-US", {
    month: "short",
  })}-${String(monthDate.getFullYear()).slice(-2)}`;
  const daysInMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  ).getDate();

  const layerRanges = [
    { startDay: 1, endDay: Math.min(15, daysInMonth), label: `1-${Math.min(15, daysInMonth)}` },
    { startDay: 16, endDay: daysInMonth, label: `16-${daysInMonth}` },
  ].filter((range) => range.startDay <= range.endDay);

  const buildRowsByRange = (startDay, endDay) => {
    const rowMap = new Map();
    let sequence = 0;

    checklistRows.forEach((entry) => {
      const localAnchor = entry?._anchorDate ?? anchorDateLike;
      if (!isChecklistSameMonth(entry?.time, localAnchor)) return;

      const day = getChecklistEntryDay(entry?.time, localAnchor);
      if (!Number.isFinite(day) || day < startDay || day > endDay) return;

      const jobType = toDisplayText(entry?.job_type, "-");
      const component = toDisplayText(entry?.componen, "-");
      const shiftKey = toDisplayText(entry?.shift, "");
      const rowKey = `${String(jobType).trim().toLowerCase()}|${String(component)
        .trim()
        .toLowerCase()}|${String(shiftKey).trim().toLowerCase()}`;

      if (!rowMap.has(rowKey)) {
        rowMap.set(rowKey, {
          jobType,
          component,
          cells: new Map(),
        });
      }

      const row = rowMap.get(rowKey);
      if (!row.cells.has(day)) row.cells.set(day, []);

      const anchorDate = toChecklistDate(localAnchor) || monthDate;
      const resolvedDateTime = toChecklistDate(entry?.time, anchorDate);
      const score = resolvedDateTime?.getTime();
      row.cells.get(day).push({
        shift: getChecklistShiftFromTime(entry?.time, entry?.shift),
        result: entry?.results ?? entry?.result ?? "",
        user: entry?.user ?? entry?._user ?? "",
        score: Number.isFinite(score) ? score : sequence,
      });
      sequence += 1;
    });

    return Array.from(rowMap.values()).map((row, rowIndex) => {
      let latestUser = "-";
      let latestUserScore = -1;
      const shiftsSeen = { 1: false, 2: false, 3: false };

      const dayCells = Array.from({ length: endDay - startDay + 1 }, (_, offset) => {
        const currentDay = startDay + offset;
        const dayEntries = row.cells.get(currentDay) || [];
        const groupedByShift = { 1: [], 2: [], 3: [] };

        dayEntries.forEach((entry) => {
          if (hasMeaningfulValue(entry?.user) && entry.score > latestUserScore) {
            latestUserScore = entry.score;
            latestUser = toDisplayText(entry.user, "-");
          }

          if ([1, 2, 3].includes(entry?.shift)) {
            groupedByShift[entry.shift].push(entry);
            shiftsSeen[entry.shift] = true;
          }
        });

        const latestByShift = { 1: null, 2: null, 3: null };
        [1, 2, 3].forEach((shiftNumber) => {
          if (groupedByShift[shiftNumber].length === 0) return;
          latestByShift[shiftNumber] = groupedByShift[shiftNumber].reduce((selected, candidate) =>
            candidate.score > selected.score ? candidate : selected
          );
        });
        return latestByShift;
      });

      return {
        rowNumber: rowIndex + 1,
        jobType: row.jobType,
        component: row.component,
        latestUser,
        shiftsSeen,
        dayCells,
      };
    });
  };

  const layers = layerRanges
    .map((range) => ({
      ...range,
      rows: buildRowsByRange(range.startDay, range.endDay),
    }))
    .filter((layer) => layer.rows.length > 0);

  if (layers.length === 0) {
    return `
      <div class="ck-empty">
        Belum ada data checklist untuk bulan ini.
      </div>
    `;
  }

  return `
    <div class="ck-wrap">
      <div class="ck-title">
        CHECKLIST CILT
      </div>
      ${layers.map((layer, index) => renderLayerTable(layer, index, monthLabel)).join("")}
    </div>
  `;
};

module.exports = { renderChecklistTableHtml };
