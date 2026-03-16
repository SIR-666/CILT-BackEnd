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
      bgColor: "transparent",
      textColor: "#111827",
    };
  }

  const lowered = text.toLowerCase();
  if (["g", "ok"].includes(lowered) || lowered.includes("ok")) {
    return {
      label: lowered.includes("not ok") ? "NOT OK" : "OK",
      bgColor: lowered.includes("not ok") ? "#f8c9cc" : "#cff5d0",
      textColor: "#111827",
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
      bgColor: "#f8c9cc",
      textColor: "#111827",
    };
  }

  if (lowered === "n" || lowered.includes("need")) {
    return {
      label: "NEED",
      bgColor: "#ffe9b0",
      textColor: "#111827",
    };
  }

  return {
    label: text,
    bgColor: "#ffe9b0",
    textColor: "#111827",
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
    <div style="position:relative; height:14px; display:flex; align-items:center; justify-content:center; border-bottom:${
      isLastSlot ? "none" : "1px solid #bfbfbf"
    }; opacity:${entry ? "1" : "0.35"}; background:${tone.bgColor}; font-weight:700; color:${
      tone.textColor
    }; line-height:1.1;">
      <span style="position:absolute; left:2px; top:0px; font-size:8px; color:#374151; font-weight:700;">
        ${shiftNumber}
      </span>
      <span>${escapeHtml(toDisplayText(tone.label, ""))}</span>
    </div>
  `;
};

const renderShiftBadge = (shiftNumber, active, isLast = false) => {
  const bgColor =
    shiftNumber === 1 ? "#dbeafe" : shiftNumber === 2 ? "#dcfce7" : "#fef9c3";
  return `
    <div style="position:relative; height:14px; display:flex; align-items:center; justify-content:center; border-bottom:${
      isLast ? "none" : "1px solid #bfbfbf"
    }; opacity:${active ? "1" : "0.35"}; font-weight:700; background:${bgColor};">
      <span style="position:absolute; left:2px; top:0px; font-size:8px;">${shiftNumber}</span>
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
    <div style="margin-top:${layerIndex === 0 ? "0" : "14px"}; margin-bottom:18px;">
      <div style="text-align:center; color:#1d4ed8; font-weight:700; font-size:11px; margin-bottom:6px;">
        ${escapeHtml(monthLabel)} - Tanggal ${escapeHtml(layer.label)}
      </div>
      ${rowChunks
        .map((chunkRows, chunkIndex) => {
          const shouldPageBreak = chunkIndex > 0 || layerIndex > 0;
          return `
            <div style="margin-top:${chunkIndex === 0 ? "0" : "8px"}; break-before:${
              shouldPageBreak ? "page" : "auto"
            }; page-break-before:${shouldPageBreak ? "always" : "auto"};">
              <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px;">
                <thead>
                  <tr>
                    <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px; width:5%;">No</th>
                    <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px; width:14%;">Job Type</th>
                    <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px; width:14%;">Component</th>
                    <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px; width:4%;">Picture</th>
                    <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px; width:9%;">User</th>
                    <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px; width:6%;">Shift</th>
                    ${Array.from({ length: dayCount }, (_, offset) => layer.startDay + offset)
                      .map(
                        (day) => `
                          <th style="border:1px solid #000; background:#3bcd6b; color:#fff; font-weight:700; padding:2px 0; width:${dayColumnWidth};">
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
                          <td style="border:1px solid #000; text-align:center; padding:2px;">
                            ${row.rowNumber}
                          </td>
                          <td style="border:1px solid #000; text-align:center; padding:2px 4px;">
                            ${escapeHtml(toDisplayText(row.jobType, "-"))}
                          </td>
                          <td style="border:1px solid #000; text-align:center; padding:2px 4px;">
                            ${escapeHtml(toDisplayText(row.component, "-"))}
                          </td>
                          <td style="border:1px solid #000; text-align:center; padding:2px;">N/A</td>
                          <td style="border:1px solid #000; text-align:left; padding:2px 4px; font-size:9px;">
                            ${escapeHtml(toDisplayText(row.latestUser, "-"))}
                          </td>
                          <td style="border:1px solid #000; padding:0;">
                            <div style="display:flex; flex-direction:column;">
                              ${renderShiftBadge(1, row.shiftsSeen[1])}
                              ${renderShiftBadge(2, row.shiftsSeen[2])}
                              ${renderShiftBadge(3, row.shiftsSeen[3], true)}
                            </div>
                          </td>
                          ${row.dayCells
                            .map(
                              (daySlot) => `
                                <td style="border:1px solid #000; padding:0;">
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
      <div style="margin-top:10px; border:1px solid #000; padding:16px; text-align:center; font-size:11px; font-style:italic; color:#555;">
        Belum ada data checklist untuk bulan ini.
      </div>
    `;
  }

  return `
    <div style="margin-top:8px;">
      <div style="text-align:center; color:#1d4ed8; font-weight:700; font-size:18px; margin-bottom:4px;">
        CHECKLIST CILT
      </div>
      ${layers.map((layer, index) => renderLayerTable(layer, index, monthLabel)).join("")}
    </div>
  `;
};

module.exports = { renderChecklistTableHtml };
