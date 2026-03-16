const normalizeText = (value) => String(value ?? "");

const normalizeToken = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const hasMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const parseInspectionRows = (rawValue) => {
  if (rawValue == null) return [];
  if (Array.isArray(rawValue)) return rawValue;

  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return parseInspectionRows(parsed);
    } catch (error) {
      return [];
    }
  }

  if (typeof rawValue === "object") {
    if (Array.isArray(rawValue.rows)) return rawValue.rows;
    if (Array.isArray(rawValue.data)) return rawValue.data;
    return [rawValue];
  }

  return [];
};

const resolveInspectionRows = (record = {}, inspectionRows = null) =>
  Array.isArray(inspectionRows)
    ? inspectionRows
    : parseInspectionRows(record?.inspectionData);

const getValueByExactKey = (row = {}, key = "") => {
  if (!row || typeof row !== "object" || Array.isArray(row)) return "";
  if (typeof key !== "string" || key.length === 0) return "";
  return row?.[key] ?? "";
};

const filterRowsByFields = (rows = [], fields = []) =>
  (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return false;
    return fields.some((field) => hasMeaningfulValue(getValueByExactKey(row, field)));
  });

const isCheckedMarker = (value) => {
  if (value === true || value === 1 || value === "1") return true;
  const normalized = normalizeText(value).trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "y";
};

const resolvePrimaryPayload = (record = {}, inspectionRows = null) => {
  const rows = resolveInspectionRows(record, inspectionRows);
  return (
    rows.find((row) => row && typeof row === "object" && !Array.isArray(row)) || {}
  );
};

const normalizePrintShift = (value) => {
  const raw = normalizeText(value).trim().toUpperCase();
  if (raw === "SHIFT 1" || raw === "1" || raw === "I") return "Shift 1";
  if (raw === "SHIFT 2" || raw === "2" || raw === "II") return "Shift 2";
  if (raw === "SHIFT 3" || raw === "3" || raw === "III") return "Shift 3";
  return "Shift 1";
};

const pad2Number = (num) => String(num).padStart(2, "0");

const getPrintShiftHours = (shift) => {
  if (shift === "Shift 1") return [6, 7, 8, 9, 10, 11, 12, 13, 14];
  if (shift === "Shift 2") return [14, 15, 16, 17, 18, 19, 20, 21, 22];
  return [22, 23, 0, 1, 2, 3, 4, 5, 6];
};

const getPrintShiftHourSlots = (shiftValue) => {
  const shiftName = normalizePrintShift(shiftValue);
  return getPrintShiftHours(shiftName).map((hour, index) => ({
    key: index + 1,
    hour,
    label: `${pad2Number(hour)}:00`,
  }));
};

const sumNumeric = (rows = [], field) =>
  (Array.isArray(rows) ? rows : []).reduce((total, row) => {
    const parsed = Number.parseFloat(getValueByExactKey(row, field));
    return total + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);

module.exports = {
  normalizeText,
  normalizeToken,
  hasMeaningfulValue,
  parseInspectionRows,
  resolveInspectionRows,
  getValueByExactKey,
  filterRowsByFields,
  isCheckedMarker,
  resolvePrimaryPayload,
  getPrintShiftHourSlots,
  sumNumeric,
};
