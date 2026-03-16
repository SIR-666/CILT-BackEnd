const { escapeHtml, toDisplayText } = require("./rendererShared");
const { resolvePrimaryPayload } = require("./packageRendererUtils");

const PROCESS_ROWS = [
  { label: "Prepare To Tube Seal", key: "prepareToTubeSeal" },
  { label: "Tube Seal", key: "tubeSeal" },
  { label: "Heat Sterilization", key: "heatSterilization" },
  { label: "Spraying", key: "spraying" },
  { label: "Sterilization Done", key: "sterilizationDone" },
  { label: "Production", key: "production" },
  { label: "Stop Production", key: "stopProduction" },
];

const COUNTER_ROWS = [
  { label: "Counter 1 Stop", key: "counter1Stop" },
  { label: "Counter 1 Start", key: "counter1Start" },
  { label: "Total Counter / Pack", key: "totalCounterPack" },
  { label: "Waste Counter 2", key: "wasteCounter2" },
  { label: "Hour Meter Start", key: "hourMeterStart" },
  { label: "Hour Meter Stop", key: "hourMeterStop" },
  { label: "Total Hour Meter", key: "totalHourMeter" },
  { label: "Exiting Counter", key: "exitingCounter" },
  { label: "Incoming Package Counter 6", key: "incomingPackageCounter6" },
];

const renderKeyValueTable = ({ title, rows = [] }) => `
  <div style="min-width:0;">
    <h3 style="text-align:center; font-weight:700; font-size:13px; margin:8px 0 6px; color:#0f172a; background:#eef3f7; border:1px solid #cbd5e1; padding:6px 8px; border-radius:6px;">
      ${escapeHtml(title)}
    </h3>
    <table class="v2-table">
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>
                <td class="left" style="font-weight:600; background:#f8fafc; width:42%;">
                  ${escapeHtml(row.label)}
                </td>
                <td class="center">
                  ${escapeHtml(toDisplayText(row.value))}
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  </div>
`;

const renderA3FlexDetailHtml = (record = {}) => {
  const primaryPayload = resolvePrimaryPayload(record);
  const headerInfo =
    primaryPayload?.headerInfo && typeof primaryPayload.headerInfo === "object"
      ? primaryPayload.headerInfo
      : {};
  const persiapanProses =
    primaryPayload?.persiapanProses && typeof primaryPayload.persiapanProses === "object"
      ? primaryPayload.persiapanProses
      : {};
  const counterPack =
    primaryPayload?.counterPack && typeof primaryPayload.counterPack === "object"
      ? primaryPayload.counterPack
      : {};
  const inkubasiQC =
    primaryPayload?.inkubasiQC && typeof primaryPayload.inkubasiQC === "object"
      ? primaryPayload.inkubasiQC
      : {};
  const sampleOperator =
    primaryPayload?.sampleOperator &&
    typeof primaryPayload.sampleOperator === "object"
      ? primaryPayload.sampleOperator
      : {};

  const mergedHeaderInfo = {
    hari: headerInfo?.hari ?? headerInfo?.judul ?? "",
    tanggal: headerInfo?.tanggal ?? "",
    namaProduk: headerInfo?.namaProduk ?? "",
    kemasan: headerInfo?.kemasan ?? "",
    mesinLine: headerInfo?.mesinLine ?? headerInfo?.lineMesin ?? headerInfo?.mesin ?? "",
    kodeProduksi: headerInfo?.kodeProduksi ?? "",
    kodeKadaluwarsa: headerInfo?.kodeKadaluwarsa ?? "",
  };

  const qualityRows = [
    {
      leftLabel: "Inkubasi",
      leftValue: inkubasiQC?.inkubasi,
      rightLabel: "Splicing Paper",
      rightValue: sampleOperator?.splicingPaper,
    },
    {
      leftLabel: "Testing QC",
      leftValue: inkubasiQC?.testingQC,
      rightLabel: "Testing Operator",
      rightValue: sampleOperator?.testingOperator,
    },
    {
      leftLabel: "Total QC",
      leftValue: inkubasiQC?.totalQC,
      rightLabel: "Total Operator",
      rightValue: sampleOperator?.totalOperator,
    },
  ];

  return `
    <p class="section-title">A3 / FLEX</p>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:8px;">
      ${renderKeyValueTable({
        title: "INFORMASI PRODUK",
        rows: [
          {
            label: "Hari / Tanggal",
            value: [mergedHeaderInfo.hari, mergedHeaderInfo.tanggal]
              .filter(Boolean)
              .join(" / "),
          },
          { label: "Nama Produk", value: mergedHeaderInfo.namaProduk },
          { label: "Mesin Line", value: mergedHeaderInfo.mesinLine },
          { label: "Kemasan", value: mergedHeaderInfo.kemasan },
          { label: "Kode Produksi", value: mergedHeaderInfo.kodeProduksi },
          { label: "Kode Kadaluwarsa", value: mergedHeaderInfo.kodeKadaluwarsa },
        ],
      })}
      <div style="min-width:0;">
        <h3 style="text-align:center; font-weight:700; font-size:13px; margin:8px 0 6px; color:#0f172a; background:#eef3f7; border:1px solid #cbd5e1; padding:6px 8px; border-radius:6px;">
          PERSIAPAN PROSES
        </h3>
        <table class="v2-table">
          <thead>
            <tr>
              <th style="width:40%;">Parameter</th>
              <th>1</th>
              <th>2</th>
              <th>3</th>
            </tr>
          </thead>
          <tbody>
            ${PROCESS_ROWS.map(
              (row) => `
                <tr>
                  <td class="left" style="font-weight:600; background:#f8fafc;">
                    ${escapeHtml(row.label)}
                  </td>
                  <td class="center">${escapeHtml(toDisplayText(persiapanProses?.[`${row.key}`]))}</td>
                  <td class="center">${escapeHtml(toDisplayText(persiapanProses?.[`${row.key}2`]))}</td>
                  <td class="center">${escapeHtml(toDisplayText(persiapanProses?.[`${row.key}3`]))}</td>
                </tr>
              `
            ).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
      ${renderKeyValueTable({
        title: "DATA COUNTER PACK",
        rows: COUNTER_ROWS.map((row) => ({
          label: row.label,
          value: counterPack?.[row.key],
        })),
      })}
      <div style="min-width:0;">
        <h3 style="text-align:center; font-weight:700; font-size:13px; margin:8px 0 6px; color:#0f172a; background:#eef3f7; border:1px solid #cbd5e1; padding:6px 8px; border-radius:6px;">
          INKUBASI QUALITY CONTROL &amp; SAMPLE OPERATOR
        </h3>
        <table class="v2-table">
          <thead>
            <tr>
              <th style="width:30%;">Inkubasi QC</th>
              <th style="width:20%;">Value</th>
              <th style="width:30%;">Sample Operator</th>
              <th style="width:20%;">Value</th>
            </tr>
          </thead>
          <tbody>
            ${qualityRows
              .map(
                (row) => `
                  <tr>
                    <td class="left" style="font-weight:600; background:#f8fafc;">${escapeHtml(
                      row.leftLabel
                    )}</td>
                    <td class="center">${escapeHtml(toDisplayText(row.leftValue))}</td>
                    <td class="left" style="font-weight:600; background:#f8fafc;">${escapeHtml(
                      row.rightLabel
                    )}</td>
                    <td class="center">${escapeHtml(toDisplayText(row.rightValue))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        <div style="border:1px solid #000; border-top:none; background:#f8fafc; padding:8px 10px;">
          <div style="text-align:center; font-weight:600; margin-bottom:4px; font-size:10px;">
            Total Inkubasi QC &amp; Sample Operator
          </div>
          <div style="text-align:center; border:1px solid #cbd5e1; background:#fff; padding:4px; min-height:16px; font-size:10px;">
            ${escapeHtml(toDisplayText(sampleOperator?.totalInkubasiDanSample))}
          </div>
        </div>
      </div>
    </div>
  `;
};

module.exports = { renderA3FlexDetailHtml };
