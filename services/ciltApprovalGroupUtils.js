const FILLER_BUNDLE_PACKAGE_TYPES = Object.freeze([
  "SEGREGASI",
  "PEMAKAIAN SCREW CAP",
  "PEMAKAIAN PAPER",
  "PENGECEKAN H2O2 ( SPRAY )",
]);

const FILLER_BUNDLE_PACKAGE_SET = new Set(FILLER_BUNDLE_PACKAGE_TYPES);
const FILLER_BUNDLE_LINE_SET = new Set(["LINE A", "LINE B", "LINE C", "LINE D"]);
const FILLER_BUNDLE_LABEL = "FILLER PACKAGE BUNDLE";
const FILLER_BUNDLE_TYPE = "FILLER_PACKAGE_BUNDLE";

const normalizeText = (value) => String(value || "").trim();

const normalizeUpperText = (value) => normalizeText(value).toUpperCase();

const normalizePackageType = (value) => {
  const normalized = normalizeUpperText(value).replace(/\s+/g, " ");
  if (!normalized) return "";
  if (normalized === "PENGECEKAN H2O2 (SPRAY)") {
    return "PENGECEKAN H2O2 ( SPRAY )";
  }
  return normalized;
};

const normalizeDateKey = (value) => {
  const raw = normalizeText(value);
  const directMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (directMatch?.[1]) return directMatch[1];

  const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeShiftKey = (value) => normalizeUpperText(value).replace(/\s+/g, "");

const toProcessOrderPackageToken = (packageType) =>
  normalizePackageType(packageType).replace(/\s+/g, "-");

const stripPackageTokenFromProcessOrder = (processOrder, packageType) => {
  const rawProcessOrder = normalizeText(processOrder);
  const packageToken = toProcessOrderPackageToken(packageType);
  if (!rawProcessOrder || !packageToken) return rawProcessOrder;

  const upperProcessOrder = rawProcessOrder.toUpperCase();
  const upperToken = packageToken.toUpperCase();
  if (upperProcessOrder.endsWith(`_${upperToken}`)) {
    return rawProcessOrder.slice(0, rawProcessOrder.length - packageToken.length - 1);
  }

  return rawProcessOrder;
};

const isApprovedValue = (value) => {
  if (value == null) return false;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "approved";
  }
  return Number(value) === 1;
};

const isRejectedValue = (value) => {
  if (value == null) return false;
  if (typeof value === "string") {
    return value.trim().toLowerCase().includes("reject");
  }
  const numeric = Number(value);
  return numeric === 2 || numeric === -1;
};

const toComparableTime = (row = {}) => {
  const candidates = [row.submitTime, row.updatedAt, row.date, row.createdAt];
  for (const candidate of candidates) {
    const parsed = new Date(String(candidate || "").replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }
  return 0;
};

const pickLatestRow = (rows = []) =>
  [...rows].sort((left, right) => toComparableTime(right) - toComparableTime(left))[0] || null;

const pickSharedValue = (rows = [], fieldNames = []) => {
  const values = [];
  for (const row of rows) {
    let resolved = "";
    for (const fieldName of fieldNames) {
      const candidate = normalizeText(row?.[fieldName]);
      if (candidate) {
        resolved = candidate;
        break;
      }
    }
    if (resolved) values.push(resolved);
  }

  const uniqueValues = Array.from(new Set(values));
  if (uniqueValues.length === 1) return uniqueValues[0];
  return uniqueValues[0] || "";
};

const pickRepresentativeValue = (rows = [], fieldNames = []) => {
  for (const fieldName of fieldNames) {
    const shared = pickSharedValue(rows, [fieldName]);
    if (shared) return shared;
  }
  return "";
};

const pickLatestValue = (rows = [], fieldName, fallback = "") => {
  const latestRow = pickLatestRow(rows);
  const resolved = normalizeText(latestRow?.[fieldName]);
  return resolved || fallback;
};

const qualifyFillerBundleRow = (row = {}) => {
  const packageType = normalizePackageType(row?.packageType);
  const line = normalizeUpperText(row?.line).replace(/\s+/g, " ");
  return (
    FILLER_BUNDLE_PACKAGE_SET.has(packageType) &&
    FILLER_BUNDLE_LINE_SET.has(line)
  );
};

const buildFillerBundleKey = (row = {}) => {
  if (!qualifyFillerBundleRow(row)) return "";

  const packageType = normalizePackageType(row?.packageType);
  const processOrderBase = stripPackageTokenFromProcessOrder(row?.processOrder, packageType);
  const parts = [
    `plant:${normalizeUpperText(row?.plant).replace(/\s+/g, " ") || "-"}`,
    `line:${normalizeUpperText(row?.line).replace(/\s+/g, " ") || "-"}`,
    `machine:${normalizeUpperText(row?.machine).replace(/\s+/g, " ") || "-"}`,
    `date:${normalizeDateKey(row?.date) || "-"}`,
    `shift:${normalizeShiftKey(row?.shift) || "-"}`,
    `po:${normalizeUpperText(processOrderBase).replace(/\s+/g, " ") || "-"}`,
    `product:${normalizeUpperText(row?.product).replace(/\s+/g, " ") || "-"}`,
    `batch:${normalizeUpperText(row?.batch).replace(/\s+/g, " ") || "-"}`,
  ];
  return parts.join("|");
};

const buildBundleDisplayId = (childIds = []) => {
  const normalizedIds = (Array.isArray(childIds) ? childIds : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (normalizedIds.length === 0) return "GROUP";
  if (normalizedIds.length === 1) return String(normalizedIds[0]);
  return `${normalizedIds[0]}+${normalizedIds.length - 1}`;
};

const buildApprovalGroupRow = ({ groupKey, childRows = [] }) => {
  const orderedChildRows = FILLER_BUNDLE_PACKAGE_TYPES.map((packageType) =>
    childRows.find((row) => normalizePackageType(row?.packageType) === packageType)
  ).filter(Boolean);
  const availablePackageTypes = orderedChildRows
    .map((row) => normalizePackageType(row?.packageType))
    .filter(Boolean);

  const latestRow = pickLatestRow(orderedChildRows) || orderedChildRows[0] || {};
  const childIds = orderedChildRows
    .map((row) => Number(row?.id))
    .filter((value) => Number.isFinite(value) && value > 0);

  const coorApproved = orderedChildRows.every((row) => isApprovedValue(row?.approval_coor));
  const spvApproved = orderedChildRows.every((row) => isApprovedValue(row?.approval_spv));
  const rejected = orderedChildRows.some((row) =>
    [row?.approval, row?.approval_coor, row?.approval_spv, row?.status].some(isRejectedValue)
  );

  const groupDate =
    pickLatestValue(orderedChildRows, "date") ||
    pickLatestValue(orderedChildRows, "submitTime") ||
    normalizeText(latestRow?.date);

  const processOrder =
    pickRepresentativeValue(orderedChildRows, ["bundleProcessOrderBase"]) ||
    pickRepresentativeValue(orderedChildRows, ["processOrder"]) ||
    normalizeText(latestRow?.processOrder);

  return {
    ...latestRow,
    id: childIds[0] || latestRow?.id,
    displayId: buildBundleDisplayId(childIds),
    date: groupDate || latestRow?.date,
    processOrder,
    shift: pickRepresentativeValue(orderedChildRows, ["shift"]) || normalizeText(latestRow?.shift),
    product:
      pickRepresentativeValue(orderedChildRows, ["product"]) || normalizeText(latestRow?.product),
    batch: pickRepresentativeValue(orderedChildRows, ["batch"]) || normalizeText(latestRow?.batch),
    packageType: FILLER_BUNDLE_LABEL,
    packageTypes: availablePackageTypes,
    approvalGroupType: FILLER_BUNDLE_TYPE,
    groupKey,
    isApprovalGroup: true,
    childIds,
    childCount: orderedChildRows.length,
    childItems: orderedChildRows,
    approval_coor: rejected ? 2 : coorApproved ? 1 : 0,
    approval_spv: rejected ? 2 : spvApproved ? 1 : 0,
    approval: rejected ? 2 : spvApproved ? 1 : 0,
    approval_coor_by: coorApproved ? pickLatestValue(orderedChildRows, "approval_coor_by") : "",
    approval_spv_by: spvApproved ? pickLatestValue(orderedChildRows, "approval_spv_by") : "",
  };
};

const buildApprovalListRows = (rows = []) => {
  const groupedCandidates = new Map();
  const groupedRowIds = new Set();

  for (const rawRow of Array.isArray(rows) ? rows : []) {
    const row = {
      ...rawRow,
      packageType: normalizePackageType(rawRow?.packageType),
      bundleProcessOrderBase: stripPackageTokenFromProcessOrder(
        rawRow?.processOrder,
        rawRow?.packageType
      ),
    };

    const groupKey = buildFillerBundleKey(row);
    if (!groupKey) continue;

    const current = groupedCandidates.get(groupKey) || {
      rows: [],
      packageMap: new Map(),
      hasDuplicatePackage: false,
    };

    const packageType = normalizePackageType(row?.packageType);
    if (current.packageMap.has(packageType)) {
      current.hasDuplicatePackage = true;
    }
    current.packageMap.set(packageType, row);
    current.rows.push(row);
    groupedCandidates.set(groupKey, current);
  }

  const approvalRows = [];

  for (const [groupKey, candidate] of groupedCandidates.entries()) {
    if (!candidate.hasDuplicatePackage && candidate.packageMap.size > 0) {
      const childRows = FILLER_BUNDLE_PACKAGE_TYPES.map((packageType) =>
        candidate.packageMap.get(packageType)
      ).filter(Boolean);

      childRows.forEach((row) => {
        if (Number.isFinite(Number(row?.id))) {
          groupedRowIds.add(Number(row.id));
        }
      });
      approvalRows.push(buildApprovalGroupRow({ groupKey, childRows }));
    }
  }

  const passthroughRows = (Array.isArray(rows) ? rows : []).filter((row) => {
    const rowId = Number(row?.id);
    return !(Number.isFinite(rowId) && groupedRowIds.has(rowId));
  });

  return [...approvalRows, ...passthroughRows];
};

module.exports = {
  FILLER_BUNDLE_LABEL,
  FILLER_BUNDLE_PACKAGE_TYPES,
  FILLER_BUNDLE_TYPE,
  buildApprovalListRows,
  buildApprovalGroupRow,
  buildFillerBundleKey,
  normalizePackageType,
};
