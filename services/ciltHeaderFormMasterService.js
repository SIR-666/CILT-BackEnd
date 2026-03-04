const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

const TABLE_NAME = "tb_CILT_HeaderFormMaster";

const createHttpError = (status, message, details) => {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
};

const isDuplicateError = (error) =>
  error?.number === 2601 || error?.number === 2627;

const normalizeOptionalText = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const normalizeRequiredText = (value, label) => {
  const text = normalizeOptionalText(value);
  if (!text) {
    throw createHttpError(400, `${label} is required`);
  }
  return text;
};

const normalizeBooleanBit = (value, fallback = 1) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value ? 1 : 0;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "active"].includes(normalized)) return 1;
  if (["0", "false", "no", "n", "inactive"].includes(normalized)) return 0;
  return fallback;
};

const mapRow = (row = {}) => ({
  id: row.id,
  package_type: row.package_type ?? "",
  line: row.line ?? null,
  frm: row.frm ?? "",
  rev: row.rev ?? "",
  berlaku: row.berlaku ?? "",
  hal: row.hal ?? "",
  is_active: Boolean(row.is_active),
  created_by: row.created_by ?? "",
  updated_by: row.updated_by ?? "",
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const preparePayload = (payload = {}, mode = "create") => {
  const packageType = normalizeRequiredText(payload.package_type, "package_type");
  const frm = normalizeRequiredText(payload.frm, "frm");
  const berlaku = normalizeRequiredText(payload.berlaku, "berlaku");
  const line = normalizeOptionalText(payload.line);
  const rev = normalizeOptionalText(payload.rev) ?? "";
  const hal = normalizeOptionalText(payload.hal) ?? "";
  const createdBy = normalizeOptionalText(payload.created_by);
  const updatedBy = normalizeOptionalText(payload.updated_by) ?? createdBy;
  const isActive = normalizeBooleanBit(payload.is_active, 1);

  return {
    packageType,
    line,
    frm,
    rev,
    berlaku,
    hal,
    isActive,
    createdBy: mode === "create" ? createdBy : null,
    updatedBy,
  };
};

async function listHeaderFormMasters({ activeOnly = false } = {}) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("active_only", sql.Bit, activeOnly ? 1 : 0)
      .query(`
        SELECT
          [id],
          [package_type],
          [line],
          [frm],
          [rev],
          [berlaku],
          [hal],
          [is_active],
          [created_by],
          [updated_by],
          [created_at],
          [updated_at]
        FROM ${TABLE_NAME}
        WHERE (@active_only = 0 OR [is_active] = 1)
        ORDER BY
          [package_type] ASC,
          CASE WHEN [line] IS NULL OR LTRIM(RTRIM([line])) = '' THEN 0 ELSE 1 END ASC,
          [line] ASC,
          [id] ASC
      `);

    return result.recordset.map(mapRow);
  } catch (error) {
    logger.error(`Error fetching Header Form Master: ${error.message}`);
    throw error;
  }
}

async function createHeaderFormMaster(payload = {}) {
  let transaction;
  try {
    const data = preparePayload(payload, "create");
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const result = await transaction
      .request()
      .input("package_type", sql.NVarChar(150), data.packageType)
      .input("line", sql.NVarChar(50), data.line)
      .input("frm", sql.NVarChar(50), data.frm)
      .input("rev", sql.NVarChar(50), data.rev)
      .input("berlaku", sql.NVarChar(100), data.berlaku)
      .input("hal", sql.NVarChar(50), data.hal)
      .input("is_active", sql.Bit, data.isActive)
      .input("created_by", sql.NVarChar(100), data.createdBy)
      .input("updated_by", sql.NVarChar(100), data.updatedBy)
      .query(`
        INSERT INTO ${TABLE_NAME}
        (
          [package_type],
          [line],
          [frm],
          [rev],
          [berlaku],
          [hal],
          [is_active],
          [created_by],
          [updated_by],
          [created_at],
          [updated_at]
        )
        OUTPUT inserted.*
        VALUES
        (
          @package_type,
          @line,
          @frm,
          @rev,
          @berlaku,
          @hal,
          @is_active,
          @created_by,
          @updated_by,
          GETDATE(),
          GETDATE()
        )
      `);

    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected[0] || 0,
      inserted: result.recordset.map(mapRow),
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Error rolling back Header Form Master create: ${rollbackError.message}`);
      }
    }

    if (isDuplicateError(error)) {
      throw createHttpError(409, "Header Form Master untuk package/line tersebut sudah ada.");
    }

    logger.error(`Error creating Header Form Master: ${error.message}`);
    throw error;
  }
}

async function updateHeaderFormMaster(id, payload = {}) {
  let transaction;
  try {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw createHttpError(400, "Invalid id");
    }

    const data = preparePayload(payload, "update");
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const result = await transaction
      .request()
      .input("id", sql.Int, numericId)
      .input("package_type", sql.NVarChar(150), data.packageType)
      .input("line", sql.NVarChar(50), data.line)
      .input("frm", sql.NVarChar(50), data.frm)
      .input("rev", sql.NVarChar(50), data.rev)
      .input("berlaku", sql.NVarChar(100), data.berlaku)
      .input("hal", sql.NVarChar(50), data.hal)
      .input("is_active", sql.Bit, data.isActive)
      .input("updated_by", sql.NVarChar(100), data.updatedBy)
      .query(`
        UPDATE ${TABLE_NAME}
        SET
          [package_type] = @package_type,
          [line] = @line,
          [frm] = @frm,
          [rev] = @rev,
          [berlaku] = @berlaku,
          [hal] = @hal,
          [is_active] = @is_active,
          [updated_by] = @updated_by,
          [updated_at] = GETDATE()
        OUTPUT inserted.*
        WHERE [id] = @id
      `);

    if (result.recordset.length === 0) {
      throw createHttpError(404, "Header Form Master not found");
    }

    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected[0] || 0,
      updated: result.recordset.map(mapRow),
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Error rolling back Header Form Master update: ${rollbackError.message}`);
      }
    }

    if (isDuplicateError(error)) {
      throw createHttpError(409, "Header Form Master untuk package/line tersebut sudah ada.");
    }

    logger.error(`Error updating Header Form Master: ${error.message}`);
    throw error;
  }
}

async function deleteHeaderFormMaster(id) {
  let transaction;
  try {
    const numericId = Number(id);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      throw createHttpError(400, "Invalid id");
    }

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const result = await transaction
      .request()
      .input("id", sql.Int, numericId)
      .query(`
        DELETE FROM ${TABLE_NAME}
        OUTPUT deleted.*
        WHERE [id] = @id
      `);

    if (result.recordset.length === 0) {
      throw createHttpError(404, "Header Form Master not found");
    }

    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected[0] || 0,
      deleted: result.recordset.map(mapRow),
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error(`Error rolling back Header Form Master delete: ${rollbackError.message}`);
      }
    }

    logger.error(`Error deleting Header Form Master: ${error.message}`);
    throw error;
  }
}

module.exports = {
  listHeaderFormMasters,
  createHeaderFormMaster,
  updateHeaderFormMaster,
  deleteHeaderFormMaster,
};
