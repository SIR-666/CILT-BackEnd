const { escapeHtml, renderV2EmptyRow, toDisplayText } = require("./rendererShared");

const normalizeChecklistRows = (rows = []) =>
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row) => ({
      jobType: toDisplayText(row?.job_type ?? row?.jobType ?? row?.activity, ""),
      component: toDisplayText(row?.componen ?? row?.component ?? row?.equipment, ""),
      result: toDisplayText(row?.results ?? row?.result ?? row?.status, ""),
      user: toDisplayText(row?.user, ""),
      time: toDisplayText(row?.time, ""),
    }));

const renderChecklistTableHtml = (rows = []) => {
  const safeRows = normalizeChecklistRows(rows);
  const rowMarkup =
    safeRows.length > 0
      ? safeRows
          .map(
            (row, index) => `
              <tr>
                <td class="center">${index + 1}</td>
                <td class="left">${escapeHtml(toDisplayText(row.jobType, ""))}</td>
                <td class="left">${escapeHtml(toDisplayText(row.component, ""))}</td>
                <td class="center">${escapeHtml(toDisplayText(row.result, ""))}</td>
              </tr>
            `
          )
          .join("")
      : renderV2EmptyRow({ colspan: 4, cellClass: "v2-empty" });

  return `
    <table class="v2-table">
      <thead>
        <tr>
          <th style="width:7%;">No</th>
          <th style="width:37%; text-align:left;">Job Type</th>
          <th style="width:38%; text-align:left;">Component</th>
          <th style="width:18%;">Result</th>
        </tr>
      </thead>
      <tbody>${rowMarkup}</tbody>
    </table>
  `;
};

module.exports = { renderChecklistTableHtml };
