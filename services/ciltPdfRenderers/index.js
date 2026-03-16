const {
  V2_RENDERER_STYLES,
  escapeHtml,
  toDisplayText,
  parseJsonArray,
  normalizeSourceType,
  normalizePackageType,
  resolveV2ReportTitle,
  resolveSubmittedBy,
  resolveV2HeaderMeta,
  renderV2ReportHeader,
  renderV2GeneralInfoTable,
  resolveV2PageSizeByPackageType,
  dedupeV2Items,
  isCipItemDescriptor,
} = require("./rendererShared");
const { renderChecklistTableHtml } = require("./checklistCiltRenderer");
const { renderCipContentHtml } = require("./cipRenderer");
const { renderFallbackCiltContentHtml } = require("./fallbackCiltRenderer");
const { renderSegregasiDetailHtml } = require("./segregasiRenderer");
const { renderScrewCapDetailHtml } = require("./screwCapRenderer");
const { renderPaperUsageDetailHtml } = require("./paperUsageRenderer");
const { renderH2o2SprayDetailHtml } = require("./h2o2SprayRenderer");
const { renderPerformaRedGreenDetailHtml } = require("./performaRedGreenRenderer");
const { renderA3FlexDetailHtml } = require("./a3FlexRenderer");
const { renderPaperA3DetailHtml } = require("./paperA3Renderer");
const { renderPemakaianH2o2A3DetailHtml } = require("./pemakaianH2o2A3Renderer");
const { renderPressureDetailHtml } = require("./pressureRenderer");
const { renderStartFinishDetailHtml } = require("./startFinishRenderer");
const { renderInformasiProdukDetailHtml } = require("./informasiProdukRenderer");
const {
  renderLaporanProduksiMesinDetailHtml,
} = require("./laporanProduksiMesinRenderer");
const {
  renderArtemaSmsCardboardDetailHtml,
} = require("./artemaSmsCardboardRenderer");
const { renderFransWp25CaseDetailHtml } = require("./fransWp25CaseRenderer");
const {
  renderRobotPalletizerFillerDetailHtml,
} = require("./robotPalletizerFillerRenderer");

const PRINT_PAGE_NAME_BY_SIZE = {
  "A4 portrait": "cilt-a4-portrait",
  "A4 landscape": "cilt-a4-landscape",
  "A3 landscape": "cilt-a3-landscape",
};

const resolveSheetPageName = (pageSize = "") =>
  PRINT_PAGE_NAME_BY_SIZE[String(pageSize || "")] || "cilt-a4-portrait";

const V2_PACKAGE_RENDERERS = Object.freeze({
  "REPORT CIP": ({ record }) => renderCipContentHtml(record),
  "CHECKLIST CILT": ({ record, inspectionRows }) =>
    renderChecklistTableHtml(inspectionRows, { date: record?.date }),
  SEGREGASI: ({ record, inspectionRows }) =>
    renderSegregasiDetailHtml(record, inspectionRows),
  "PEMAKAIAN SCREW CAP": ({ record }) => renderScrewCapDetailHtml(record),
  "PEMAKAIAN PAPER": ({ record }) => renderPaperUsageDetailHtml(record),
  "PENGECEKAN H2O2 ( SPRAY )": ({ record }) => renderH2o2SprayDetailHtml(record),
  "PERFORMA RED AND GREEN": ({ record, inspectionRows }) =>
    renderPerformaRedGreenDetailHtml(record, inspectionRows),
  "A3 / FLEX": ({ record }) => renderA3FlexDetailHtml(record),
  "PAPER A3": ({ record }) => renderPaperA3DetailHtml(record),
  "PEMAKAIAN H2O2 A3": ({ record }) => renderPemakaianH2o2A3DetailHtml(record),
  "PENGECEKAN PRESSURE": ({ record }) => renderPressureDetailHtml(record),
  "START & FINISH": ({ record }) => renderStartFinishDetailHtml(record),
  "INFORMASI PRODUK": ({ record }) => renderInformasiProdukDetailHtml(record),
  "LAPORAN PRODUKSI MESIN": ({ record }) => renderLaporanProduksiMesinDetailHtml(record),
  "LAPORAN ARTEMA & SMS CARDBOARD": ({ record }) => renderArtemaSmsCardboardDetailHtml(record),
  "LAPORAN FRANS WP 25 CASE": ({ record }) => renderFransWp25CaseDetailHtml(record),
  "ROBOT PALLETIZER FILLER": ({ record }) => renderRobotPalletizerFillerDetailHtml(record),
});

const V2_SUPPORTED_PACKAGE_TYPES = Object.freeze(
  Object.keys(V2_PACKAGE_RENDERERS).sort()
);

const fetchV2RecordByItem = async (item = {}, services = {}) => {
  const { ciltService, cipService } = services;
  if (!ciltService || typeof ciltService.getCILT !== "function") {
    throw new Error("Invalid ciltService dependency.");
  }
  if (!cipService || typeof cipService.getCIPReportById !== "function") {
    throw new Error("Invalid cipService dependency.");
  }

  if (isCipItemDescriptor(item)) {
    const record = await cipService.getCIPReportById(item.id);
    if (!record) {
      throw new Error(`CIP report id ${item.id} not found.`);
    }
    return {
      sourceType: "CIP",
      packageType: "REPORT CIP",
      record,
    };
  }

  const record = await ciltService.getCILT(item.id);
  if (!record) {
    throw new Error(`CILT report id ${item.id} not found.`);
  }
  return {
    sourceType: "CILT",
    packageType: normalizePackageType(record.packageType),
    record,
  };
};

const buildFallbackRenderer = (packageType = "") => ({ record }) =>
  renderFallbackCiltContentHtml(record, packageType);

const resolvePackageRenderer = (packageType = "") => {
  const normalizedPackageType = normalizePackageType(packageType);
  return (
    V2_PACKAGE_RENDERERS[normalizedPackageType] ||
    buildFallbackRenderer(normalizedPackageType)
  );
};

const buildV2SheetFromRecord = ({
  packageType,
  sourceType,
  record,
  headerMeta = {},
  normalizePageSize,
}) => {
  const normalizedPackageType = normalizePackageType(packageType);
  const isCipSource = normalizeSourceType(sourceType) === "CIP";
  const packageTypeKey =
    normalizedPackageType || (isCipSource ? "REPORT CIP" : "CILT REPORT");
  const reportTitle = isCipSource
    ? "REPORT CIP"
    : resolveV2ReportTitle(packageTypeKey) || "CILT REPORT";
  const packageRenderer = resolvePackageRenderer(packageTypeKey);

  const pageSize = isCipSource
    ? "A4 portrait"
    : resolveV2PageSizeByPackageType(packageTypeKey);
  const meta = resolveV2HeaderMeta(packageTypeKey, headerMeta);
  const inspectionRows = isCipSource
    ? parseJsonArray(record?.steps || record?.stepsData)
    : parseJsonArray(record?.inspectionData);
  const submittedBy = resolveSubmittedBy({ record, inspectionRows });
  const headerHtml = renderV2ReportHeader({
    title: reportTitle,
    pageSize,
    headerMeta: meta,
    normalizePageSize,
  });
  const generalInfoHtml = renderV2GeneralInfoTable({
    record,
    submittedBy,
    packageType: packageTypeKey,
  });
  const detailHtml = packageRenderer({
    record,
    inspectionRows,
    packageType: packageTypeKey,
  });

  const processOrder = isCipSource
    ? toDisplayText(record?.processOrder ?? record?.process_order, "")
    : toDisplayText(record?.processOrder, "");

  return {
    pageSize,
    html: `
      <section class="cilt-print-sheet" data-page-size="${escapeHtml(
        pageSize
      )}" style="page:${escapeHtml(resolveSheetPageName(pageSize))};">
        ${headerHtml}
        <div class="report-info">
          <p class="report-process-order"><strong>Process Order:</strong> ${escapeHtml(
            processOrder
          )}</p>
          ${generalInfoHtml}
        </div>
        ${detailHtml}
      </section>
    `,
  };
};

module.exports = {
  V2_RENDERER_STYLES,
  V2_SUPPORTED_PACKAGE_TYPES,
  dedupeV2Items,
  fetchV2RecordByItem,
  buildV2SheetFromRecord,
};
