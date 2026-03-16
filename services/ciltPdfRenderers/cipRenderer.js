const { parseJsonArray, toDisplayText, escapeHtml } = require("./rendererShared");

const hasMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const renderCipContentHtml = (record = {}) => {
  const steps = parseJsonArray(record?.steps || record?.cip_steps || record?.stepsData);
  const copRecords = parseJsonArray(record?.copRecords || record?.cop_records);
  const specialRecords = parseJsonArray(record?.specialRecords || record?.special_records);
  const lineCode = String(record?.line || "").toUpperCase().trim();
  const toCipDisplay = (value, fallback = "-") => toDisplayText(value, fallback);

  const buildRangeText = (min, max, unit = "") => {
    const minText = toCipDisplay(min);
    const maxText = toCipDisplay(max);
    const suffix = unit ? ` ${unit}` : "";
    if (minText === "-" && maxText === "-") return "-";
    return `${minText} - ${maxText}${suffix}`;
  };

  const renderInfoTable = (rows = []) => `
    <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px;">
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td style="border:1px solid #000; background:#f3f4f6; font-weight:700; padding:5px 7px; width:28%;">
                  ${escapeHtml(toCipDisplay(row?.label, "-"))}
                </td>
                <td style="border:1px solid #000; padding:5px 7px;">
                  ${escapeHtml(toCipDisplay(row?.value, "-"))}
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;

  const renderRecordList = (records = [], sectionKey = "special") => {
    if (!Array.isArray(records) || records.length === 0) return "";
    return `
      <div style="margin-top:10px;">
        ${records
          .map((recordItem) => {
            const stepTypeRaw = recordItem?.stepType || recordItem?.step_type || "-";
            const stepType = String(stepTypeRaw || "").toUpperCase();
            const startTime = recordItem?.startTime ?? recordItem?.start_time;
            const endTime = recordItem?.endTime ?? recordItem?.end_time;
            const tempActual = recordItem?.tempActual ?? recordItem?.temp_actual;
            const tempMin = recordItem?.tempMin ?? recordItem?.temp_min;
            const tempMax = recordItem?.tempMax ?? recordItem?.temp_max;
            const concActual = recordItem?.concActual ?? recordItem?.conc_actual;
            const concMin = recordItem?.concMin ?? recordItem?.conc_min;
            const concMax = recordItem?.concMax ?? recordItem?.conc_max;
            const tempBC = recordItem?.tempBC ?? recordItem?.temp_bc;
            const tempDMin = recordItem?.tempDMin ?? recordItem?.temp_d_min;
            const tempDMax = recordItem?.tempDMax ?? recordItem?.temp_d_max;

            let tempText = `${toCipDisplay(tempActual)}°C (${buildRangeText(
              tempMin,
              tempMax,
              "°C"
            )})`;
            if (stepType.includes("DISINFECT") || stepType.includes("SANITASI")) {
              tempText =
                lineCode === "LINE D"
                  ? `${toCipDisplay(tempActual)}°C (${buildRangeText(
                      tempDMin ?? "20",
                      tempDMax ?? "35",
                      "°C"
                    )})`
                  : `${toCipDisplay(tempActual)}°C (${toCipDisplay(tempBC, "40")}°C)`;
            }

            return `
              <div style="border:1px solid #000; margin-bottom:8px; page-break-inside:avoid; break-inside:avoid;">
                <div style="background:${
                  sectionKey === "cop" ? "#fef3c7" : "#ffedd5"
                }; border-bottom:1px solid #000; padding:4px 6px; font-weight:700; font-size:10px; display:flex; justify-content:space-between; gap:8px;">
                  <span>${escapeHtml(toCipDisplay(stepTypeRaw))}</span>
                  <span>${escapeHtml(toCipDisplay(startTime))} - ${escapeHtml(
                    toCipDisplay(endTime)
                  )}</span>
                </div>
                <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px;">
                  <tbody>
                    <tr>
                      <td style="border:1px solid #ddd; background:#f9fafb; font-weight:700; padding:4px 6px; width:24%;">
                        Temp
                      </td>
                      <td style="border:1px solid #ddd; padding:4px 6px;">${escapeHtml(
                        tempText
                      )}</td>
                    </tr>
                    <tr>
                      <td style="border:1px solid #ddd; background:#f9fafb; font-weight:700; padding:4px 6px;">
                        Time
                      </td>
                      <td style="border:1px solid #ddd; padding:4px 6px;">${escapeHtml(
                        `${toCipDisplay(recordItem?.time)} min`
                      )}</td>
                    </tr>
                    ${
                      hasMeaningfulValue(concActual) ||
                      hasMeaningfulValue(concMin) ||
                      hasMeaningfulValue(concMax)
                        ? `
                          <tr>
                            <td style="border:1px solid #ddd; background:#f9fafb; font-weight:700; padding:4px 6px;">
                              Conc
                            </td>
                            <td style="border:1px solid #ddd; padding:4px 6px;">
                              ${escapeHtml(
                                `${toCipDisplay(concActual)}% (${buildRangeText(
                                  concMin,
                                  concMax,
                                  "%"
                                )})`
                              )}
                            </td>
                          </tr>
                        `
                        : ""
                    }
                    ${
                      hasMeaningfulValue(recordItem?.kode ?? recordItem?.code)
                        ? `
                          <tr>
                            <td style="border:1px solid #ddd; background:#f9fafb; font-weight:700; padding:4px 6px;">
                              Kode
                            </td>
                            <td style="border:1px solid #ddd; padding:4px 6px;">
                              ${escapeHtml(toCipDisplay(recordItem?.kode ?? recordItem?.code))}
                            </td>
                          </tr>
                        `
                        : ""
                    }
                  </tbody>
                </table>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  };

  return `
    <div style="margin-top:8px;">
      <div style="margin-bottom:10px;">
        ${renderInfoTable([
          { label: "CIP Type", value: toCipDisplay(record?.cipType || record?.cip_type) },
          { label: "Posisi", value: toCipDisplay(record?.posisi) },
          { label: "Operator", value: toCipDisplay(record?.operator) },
          { label: "Status", value: toCipDisplay(record?.status) },
          { label: "Flow Rate", value: toCipDisplay(record?.flowRate || record?.flow_rate) },
          {
            label: "Flow Rate D/BC",
            value: `${toCipDisplay(record?.flowRateD || record?.flow_rate_d)} / ${toCipDisplay(
              record?.flowRateBC || record?.flow_rate_bc
            )}`,
          },
        ])}
      </div>

      <div style="border:1px solid #000; page-break-inside:avoid; break-inside:avoid;">
        <div style="background:#dcfce7; border-bottom:1px solid #000; padding:6px; font-weight:700; font-size:11px;">
          CIP Steps
        </div>
        <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:10px;">
          <thead>
            <tr>
              <th style="border:1px solid #000; background:#f0fdf4; padding:4px 6px; width:7%;">No</th>
              <th style="border:1px solid #000; background:#f0fdf4; padding:4px 6px; width:31%;">Step</th>
              <th style="border:1px solid #000; background:#f0fdf4; padding:4px 6px; width:20%;">Supply</th>
              <th style="border:1px solid #000; background:#f0fdf4; padding:4px 6px; width:20%;">Return</th>
              <th style="border:1px solid #000; background:#f0fdf4; padding:4px 6px; width:22%;">Target/Actual</th>
            </tr>
          </thead>
          <tbody>
            ${
              steps.length === 0
                ? `
                  <tr>
                    <td colspan="5" style="border:1px solid #000; padding:8px; text-align:center; font-style:italic; color:#6b7280;">
                      No CIP step data available
                    </td>
                  </tr>
                `
                : steps
                    .map(
                      (row, index) => `
                        <tr>
                          <td style="border:1px solid #000; padding:4px 6px; text-align:center;">${
                            index + 1
                          }</td>
                          <td style="border:1px solid #000; padding:4px 6px;">
                            ${escapeHtml(
                              toCipDisplay(
                                row?.stepName || row?.step || row?.description || row?.activity
                              )
                            )}
                          </td>
                          <td style="border:1px solid #000; padding:4px 6px;">
                            ${escapeHtml(toCipDisplay(row?.supplyPipe ?? row?.supply))}
                          </td>
                          <td style="border:1px solid #000; padding:4px 6px;">
                            ${escapeHtml(toCipDisplay(row?.returnPipe ?? row?.return))}
                          </td>
                          <td style="border:1px solid #000; padding:4px 6px;">
                            ${escapeHtml(
                              `${toCipDisplay(row?.target ?? row?.targetValue)} / ${toCipDisplay(
                                row?.actual ?? row?.actualValue
                              )}`
                            )}
                          </td>
                        </tr>
                      `
                    )
                    .join("")
            }
          </tbody>
        </table>
      </div>

      ${
        copRecords.length > 0
          ? `
            <div style="margin-top:10px;">
              <div style="font-weight:700; font-size:11px; margin-bottom:6px; color:#92400e;">
                COP / SOP / SIP Records
              </div>
              ${renderRecordList(copRecords, "cop")}
            </div>
          `
          : ""
      }

      ${
        specialRecords.length > 0
          ? `
            <div style="margin-top:10px;">
              <div style="font-weight:700; font-size:11px; margin-bottom:6px; color:#9a3412;">
                Special Records
              </div>
              ${renderRecordList(specialRecords, "special")}
            </div>
          `
          : ""
      }
    </div>
  `;
};

module.exports = { renderCipContentHtml };
