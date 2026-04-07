const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");
const { buildApprovalListRows } = require("./ciltApprovalGroupUtils");

const APPROVER_ROLE_MARKER_REGEX = /\s*\[ROLE:[A-Z]+\]\s*$/i;
const MAX_BATCH_ID_COUNT = 100;

const normalizeApproverRoleTag = (value) => {
  const token = String(value || "")
    .trim()
    .toUpperCase();

  if (!token) return "";
  if (token.includes("PRF")) return "PRF";
  if (token.includes("MGR") || token.includes("MANAGER")) return "MGR";
  if (token.includes("COOR") || token.includes("COORD")) return "COOR";
  if (token.includes("SPV") || token.includes("SUPERVISOR")) return "SPV";
  return "";
};

const formatApproverUsername = (username, approverRole) => {
  const rawUsername = String(username || "").trim();
  const cleanedUsername = rawUsername.replace(APPROVER_ROLE_MARKER_REGEX, "").trim();
  const normalizedRoleTag = normalizeApproverRoleTag(approverRole);

  if (!normalizedRoleTag) {
    return cleanedUsername || rawUsername;
  }

  return `${cleanedUsername || rawUsername} [ROLE:${normalizedRoleTag}]`;
};

async function createCILT(order) {
  try {
    const pool = await getPool();

    // 1) Cek eksistensi berdasarkan kombinasi kunci agar tidak menimpa data lain
    const checkResult = await pool
      .request()
      .input("processOrder", order.processOrder)
      .input("plant", order.plant)
      .input("line", order.line)
      .input("shift", order.shift)
      .input("machine", order.machine)
      .input("dateOnly", sql.DateTime, order.date ? new Date(order.date) : null)
      .query(`
        SELECT TOP 1 id 
        FROM tb_CILT 
        WHERE processOrder = @processOrder
          AND packageType != 'PERFORMA RED AND GREEN'
          AND plant   = @plant
          AND line    = @line
          AND shift   = @shift
          AND machine = @machine
          AND CAST(date AS DATE) = CAST(@dateOnly AS DATE)
      `);

    const exists = checkResult.recordset.length > 0;

    // 2) Jika ada → UPDATE
    if (exists) {
      const id = checkResult.recordset[0].id;

      await pool
        .request()
        .input("id", id)
        .input("packageType", order.packageType)
        .input("plant", order.plant)
        .input("line", order.line)
        .input("date", order.date || null)
        .input("shift", order.shift)
        .input("product", order.product)
        .input("machine", order.machine)
        .input("batch", order.batch)
        .input("remarks", sql.NVarChar(sql.MAX), order.remarks)
        .input(
          "inspectionData",
          sql.NVarChar(sql.MAX),
          JSON.stringify(order.inspectionData)
        )
        .input("formOpenTime", order.formOpenTime)
        .input("submitTime", order.submitTime)
        .input("data1", order.data1)
        .input("data2", order.data2)
        .input("status", order.status).query(`
          UPDATE tb_CILT SET
            packageType = @packageType,
            plant = @plant,
            line = @line,
            date = @date,
            shift = @shift,
            product = @product,
            machine = @machine,
            batch = @batch,
            remarks = @remarks,
            inspectionData = @inspectionData,
            formOpenTime = @formOpenTime,
            submitTime = @submitTime,
            data1 = @data1,
            data2 = @data2,
            status = @status,
            updatedAt = GETDATE()
          WHERE id = @id
        `);

      return { ...order, id };
    }

    // 3) Kalau tidak ada → INSERT baru
    const insertResult = await pool
      .request()
      .input("processOrder", order.processOrder)
      .input("packageType", order.packageType)
      .input("plant", order.plant)
      .input("line", order.line)
      .input("date", order.date || null)
      .input("shift", order.shift)
      .input("product", order.product)
      .input("machine", order.machine)
      .input("batch", order.batch)
      .input("remarks", sql.NVarChar(sql.MAX), order.remarks)
      .input(
        "inspectionData",
        sql.NVarChar(sql.MAX),
        JSON.stringify(order.inspectionData)
      )
      .input("formOpenTime", order.formOpenTime)
      .input("submitTime", order.submitTime)
      .input("data1", order.data1)
      .input("data2", order.data2)
      .input("status", order.status).query(`
        INSERT INTO tb_CILT (
          processOrder, packageType, plant, line, date, shift,
          product, machine, batch, remarks, inspectionData,
          formOpenTime, submitTime, data1, data2, status
        ) OUTPUT inserted.id
        VALUES (
          @processOrder, @packageType, @plant, @line, @date, @shift,
          @product, @machine, @batch, @remarks, @inspectionData,
          @formOpenTime, @submitTime, @data1, @data2, @status
        )
      `);

    const newId = insertResult.recordset[0].id;
    return { ...order, id: newId };
  } catch (err) {
    console.error("Error creating/updating CILT record:", err);
    throw err;
  }
}

async function getCILT(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM tb_CILT WHERE id = @id");
    return result.recordset[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
}

function buildIdBatches(ids = [], batchSize = MAX_BATCH_ID_COUNT) {
  const normalizedIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    )
  );

  const batches = [];
  for (let index = 0; index < normalizedIds.length; index += batchSize) {
    batches.push(normalizedIds.slice(index, index + batchSize));
  }
  return batches;
}

function normalizeIdList(ids = []) {
  return Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [ids])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.floor(value))
    )
  );
}

function buildIdPlaceholders(request, ids = [], prefix = "id") {
  return ids.map((id, index) => {
    const paramName = `${prefix}_${index}`;
    request.input(paramName, sql.Int, id);
    return `@${paramName}`;
  });
}

function normalizeApprovalLevel(value) {
  const token = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, "");
  if (!token) return null;
  if (token.includes("COOR") || token.includes("COORD")) return "coor";
  if (token.includes("SPV") || token.includes("SUPERVISOR")) return "spv";
  return null;
}

async function queryCiltRowsByFilters(filters = {}) {
  const pool = await getPool();
  let query = `
    SELECT
      *,
      approval_coor,
      approval_coor_by,
      approval_coor_at,
      approval_spv,
      approval_spv_by,
      approval_spv_at,
      approval
    FROM tb_CILT
    WHERE 1=1
  `;
  const request = pool.request();

  if (filters.status !== undefined) {
    query += " AND status = @status";
    request.input("status", sql.Int, parseInt(filters.status));
  }
  if (filters.plant) {
    query += " AND plant = @plant";
    request.input("plant", sql.VarChar, filters.plant);
  }
  if (filters.line) {
    query += " AND line = @line";
    request.input("line", sql.VarChar, filters.line);
  }
  if (filters.shift) {
    query += " AND shift = @shift";
    request.input("shift", sql.VarChar, filters.shift);
  }
  if (filters.date) {
    query += " AND CONVERT(VARCHAR, date, 23) = @date";
    request.input("date", sql.VarChar, filters.date);
  }

  query += " ORDER BY id DESC";

  const result = await request.query(query);
  return result.recordset || [];
}

async function queryCiltApprovalStatesByIds(transaction, ids = []) {
  const request = transaction.request();
  const placeholders = buildIdPlaceholders(request, ids, "state_id");
  const result = await request.query(`
    SELECT
      id,
      ISNULL(approval_coor, 0) AS approval_coor,
      approval_coor_by,
      approval_coor_at,
      ISNULL(approval_spv, 0) AS approval_spv,
      approval_spv_by,
      approval_spv_at,
      ISNULL(approval, 0) AS approval
    FROM tb_CILT
    WHERE id IN (${placeholders.join(", ")})
  `);
  return Array.isArray(result.recordset) ? result.recordset : [];
}

async function ensureExistingIds(transaction, ids = []) {
  const stateRows = await queryCiltApprovalStatesByIds(transaction, ids);
  const existingIds = new Set(stateRows.map((row) => Number(row.id)));
  const missingIds = ids.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw new Error(`CILT record not found for id(s): ${missingIds.join(", ")}`);
  }
  return stateRows;
}

async function ensureCompleteApprovalGroupIds(ids = []) {
  const normalizedIds = normalizeIdList(ids);
  if (normalizedIds.length === 0) {
    throw new Error("ids is required.");
  }

  const rowsMap = await getCILTsByIds(normalizedIds);
  const rows = normalizedIds.map((id) => rowsMap.get(id)).filter(Boolean);
  if (rows.length !== normalizedIds.length) {
    throw new Error("Some CILT bundle items were not found.");
  }

  const approvalRows = buildApprovalListRows(rows);
  if (approvalRows.length !== 1 || approvalRows[0]?.isApprovalGroup !== true) {
    throw new Error("Selected ids do not form a valid CILT approval bundle.");
  }

  const groupedIds = normalizeIdList(approvalRows[0].childIds);
  if (
    groupedIds.length !== normalizedIds.length ||
    groupedIds.some((id) => !normalizedIds.includes(id))
  ) {
    throw new Error("Selected ids do not match the resolved CILT approval bundle.");
  }

  return rows;
}

async function getCILTsByIds(ids = []) {
  try {
    const batches = buildIdBatches(ids);
    if (batches.length === 0) {
      return new Map();
    }

    const pool = await getPool();
    const batchResults = await Promise.all(
      batches.map(async (batch, batchIndex) => {
        const request = pool.request();
        const placeholders = batch.map((id, idIndex) => {
          const paramName = `id_${batchIndex}_${idIndex}`;
          request.input(paramName, sql.Int, id);
          return `@${paramName}`;
        });

        const result = await request.query(
          `SELECT * FROM tb_CILT WHERE id IN (${placeholders.join(", ")})`
        );
        return Array.isArray(result.recordset) ? result.recordset : [];
      })
    );

    return new Map(batchResults.flat().map((row) => [Number(row.id), row]));
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function getAllCILT(status) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("status", sql.NVarChar, status)
      .query("SELECT * FROM tb_CILT WHERE status = @status ORDER BY id DESC");
    return result.recordset;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function updateCILT(id, order) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("processOrder", sql.VarChar, order.processOrder)
      .input("packageType", sql.VarChar, order.packageType)
      .input("plant", sql.VarChar, order.plant)
      .input("line", sql.VarChar, order.line)
      .input("date", order.date ? order.date : null)
      .input("shift", sql.VarChar, order.shift)
      .input("product", sql.VarChar, order.product)
      .input("machine", sql.VarChar, order.machine)
      .input("batch", sql.VarChar, order.batch)
      .input("remarks", sql.NVarChar(sql.MAX), order.remarks)
      .input(
        "inspectionData",
        sql.NVarChar(sql.MAX),
        JSON.stringify(order.inspectionData)
      )
      .input("formOpenTime", order.formOpenTime)
      .input("submitTime", order.submitTime)
      .input("data1", sql.NVarChar, order.data1)
      .input("data2", sql.NVarChar, order.data2)
      .input("status", order.status).query(`
        UPDATE tb_CILT
        SET processOrder = @processOrder,
            packageType = @packageType,
            plant = @plant,
            line = @line,
            date = @date,
            shift = @shift,
            product = @product,
            machine = @machine,
            batch = @batch,
            remarks = @remarks,
            inspectionData = @inspectionData,
            formOpenTime = @formOpenTime,
            submitTime = @submitTime,
            data1 = @data1,
            data2 = @data2,
            status = @status,
            updatedAt = GETDATE()
        WHERE id = @id
      `);

    return result.rowsAffected[0];
  } catch (err) {
    console.error("Error updating CILT record:", err);
    throw err;
  }
}

async function deleteCILT(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM tb_CILT WHERE id = @id");
    return result.rowsAffected[0];
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function checkDraft(status) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("status", sql.VarChar, status)
      .query("SELECT * FROM tb_CILT WHERE status = @status");
    return result.recordset;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function getReportCILTAll(packageType, plant, line, shift, machine, date) {
  try {
    const pool = await getPool();
    const formattedDate = date.replace(/-/g, ""); // 'YYYYMMDD'

    const query = `
      SELECT 
          DATEPART(HOUR, tc.date) AS HourGroup,
          COUNT(*) AS RecordCount,
          MAX(tc.date) AS LastRecordTime,
          MAX(tc.submitTime) AS LastSubmitTime,
          tc.packageType, 
          tc.plant, 
          tc.line, 
          tc.shift, 
          tc.machine, 
          STUFF((
              SELECT ', ' + sub.inspectionData
              FROM tb_CILT sub
              WHERE 
                  sub.packageType = tc.packageType
                  AND sub.plant       = tc.plant
                  AND sub.line        = tc.line
                  AND sub.shift       = tc.shift
                  AND sub.machine     = tc.machine
                  AND CONVERT(VARCHAR, sub.date, 112) = @formattedDate
                  AND DATEPART(HOUR, sub.date) = DATEPART(HOUR, tc.date)
              FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS CombinedInspectionData
      FROM tb_CILT tc
      WHERE 
          tc.packageType = @packageType
          AND tc.plant   = @plant
          AND tc.line    = @line
          AND tc.shift   = @shift
          AND tc.machine = @machine
          AND CONVERT(VARCHAR, tc.date, 112) = @formattedDate
      GROUP BY 
          DATEPART(HOUR, tc.date),
          tc.packageType, tc.plant, tc.line, tc.shift, tc.machine
      ORDER BY HourGroup;
    `;

    const result = await pool
      .request()
      .input("packageType", sql.VarChar, packageType)
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .input("shift", sql.VarChar, shift)
      .input("machine", sql.VarChar, machine)
      .input("formattedDate", sql.VarChar, formattedDate)
      .query(query);

    return result.recordset;
  } catch (error) {
    console.error("SQL Query Error:", error);
    throw new Error("Failed to execute SQL query");
  }
}

async function getSKU(filter) {
  try {
    const pool = await getPool();
    let query = `SELECT id, sku AS material, category, volume FROM Product`;
    const request = pool.request();

    if (filter) {
      query += ` WHERE sku = @filter`;
      request.input("filter", sql.VarChar, filter);
    }

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function checkCiltByProcessOrder(processOrder, filters = {}) {
  try {
    const pool = await getPool();
    const request = pool.request().input("processOrder", sql.VarChar, processOrder);
    let query = `
      SELECT TOP 1 *
      FROM tb_CILT
      WHERE processOrder = @processOrder
    `;

    if (filters.packageType) {
      query += " AND packageType = @packageType";
      request.input("packageType", sql.VarChar, filters.packageType);
    }
    if (filters.plant) {
      query += " AND plant = @plant";
      request.input("plant", sql.VarChar, filters.plant);
    }
    if (filters.line) {
      query += " AND line = @line";
      request.input("line", sql.VarChar, filters.line);
    }
    if (filters.machine) {
      query += " AND machine = @machine";
      request.input("machine", sql.VarChar, filters.machine);
    }
    if (filters.shift) {
      query += " AND shift = @shift";
      request.input("shift", sql.VarChar, filters.shift);
    }

    query += " ORDER BY ISNULL(updatedAt, submitTime) DESC, id DESC";

    const result = await request.query(query);

    if (result.recordset.length > 0) {
      return {
        exists: true,
        data: result.recordset[0],
      };
    } else {
      return {
        exists: false,
        data: null,
      };
    }
  } catch (error) {
    console.error("Error checking CILT by processOrder:", error);
    throw error;
  }
}

async function approveByCoor(id, username, options = {}) {
  try {
    const pool = await getPool();
    const formattedUsername = formatApproverUsername(username, options.approverRole);
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.VarChar, formattedUsername)
      .query(`
        UPDATE tb_CILT 
        SET 
          approval_coor = 1,
          approval_coor_by = @username,
          approval_coor_at = GETDATE(),
          updatedAt = GETDATE()
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      throw new Error("Record not found");
    }

    return { success: true, message: "Approved by Coordinator" };
  } catch (error) {
    console.error("Error approving by coordinator:", error);
    throw error;
  }
}

async function approveBySpv(id, username, options = {}) {
  try {
    const pool = await getPool();
    const bypassCoordinatorApproval = options.bypassCoordinatorApproval === true;
    const formattedUsername = formatApproverUsername(username, options.approverRole);

    const checkResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT approval_coor FROM tb_CILT WHERE id = @id");

    if (checkResult.recordset.length === 0) {
      throw new Error("Record not found");
    }

    if (!bypassCoordinatorApproval && checkResult.recordset[0].approval_coor !== 1) {
      throw new Error("Waiting for Coordinator approval first");
    }

    const autoApproveCoordinator =
      bypassCoordinatorApproval && checkResult.recordset[0].approval_coor !== 1 ? 1 : 0;

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.VarChar, formattedUsername)
      .input("autoApproveCoordinator", sql.Int, autoApproveCoordinator)
      .query(`
        UPDATE tb_CILT 
        SET 
          approval_spv = 1,
          approval_spv_by = @username,
          approval_spv_at = GETDATE(),
          approval_coor = CASE
            WHEN @autoApproveCoordinator = 1 THEN 1
            ELSE approval_coor
          END,
          approval_coor_by = CASE
            WHEN @autoApproveCoordinator = 1 AND approval_coor <> 1 THEN @username
            ELSE approval_coor_by
          END,
          approval_coor_at = CASE
            WHEN @autoApproveCoordinator = 1 AND approval_coor <> 1 THEN GETDATE()
            ELSE approval_coor_at
          END,
          approval = 1,
          updatedAt = GETDATE()
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      throw new Error("Record not found");
    }

    return {
      success: true,
      message:
        autoApproveCoordinator === 1
          ? "Approved by Supervisor (Coordinator auto-approved)"
          : "Approved by Supervisor",
    };
  } catch (error) {
    console.error("Error approving by supervisor:", error);
    throw error;
  }
}

async function getAllCILTWithFilters(filters) {
  try {
    return await queryCiltRowsByFilters(filters);
  } catch (error) {
    console.error("Error fetching CILT with filters:", error);
    throw error;
  }
}

async function getApprovalGroups(filters = {}) {
  try {
    const rows = await queryCiltRowsByFilters(filters);
    return buildApprovalListRows(rows);
  } catch (error) {
    console.error("Error fetching CILT approval groups:", error);
    throw error;
  }
}

async function approveByCoorBatch(ids = [], username, options = {}) {
  let transaction;
  try {
    const normalizedIds = normalizeIdList(ids);
    if (normalizedIds.length === 0) {
      throw new Error("ids is required.");
    }

    if (options.requireApprovalGroup !== false) {
      await ensureCompleteApprovalGroupIds(normalizedIds);
    }

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    await ensureExistingIds(transaction, normalizedIds);

    const request = transaction.request();
    const placeholders = buildIdPlaceholders(request, normalizedIds, "approve_coor_id");
    const formattedUsername = formatApproverUsername(username, options.approverRole);

    request.input("username", sql.VarChar, formattedUsername);
    const result = await request.query(`
      UPDATE tb_CILT
      SET
        approval_coor = 1,
        approval_coor_by = @username,
        approval_coor_at = GETDATE(),
        updatedAt = GETDATE()
      WHERE id IN (${placeholders.join(", ")})
    `);

    await transaction.commit();
    return {
      success: true,
      message: "Approved by Coordinator",
      ids: normalizedIds,
      rowsAffected: result.rowsAffected[0] || 0,
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Error rolling back coordinator batch approval:", rollbackError);
      }
    }
    console.error("Error approving CILT batch by coordinator:", error);
    throw error;
  }
}

async function approveBySpvBatch(ids = [], username, options = {}) {
  let transaction;
  try {
    const normalizedIds = normalizeIdList(ids);
    if (normalizedIds.length === 0) {
      throw new Error("ids is required.");
    }

    if (options.requireApprovalGroup !== false) {
      await ensureCompleteApprovalGroupIds(normalizedIds);
    }

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const stateRows = await ensureExistingIds(transaction, normalizedIds);
    const bypassCoordinatorApproval = options.bypassCoordinatorApproval === true;

    if (
      !bypassCoordinatorApproval &&
      stateRows.some((row) => Number(row.approval_coor) !== 1)
    ) {
      throw new Error("Waiting for Coordinator approval first");
    }

    const request = transaction.request();
    const placeholders = buildIdPlaceholders(request, normalizedIds, "approve_spv_id");
    const formattedUsername = formatApproverUsername(username, options.approverRole);

    request.input("username", sql.VarChar, formattedUsername);
    request.input(
      "autoApproveCoordinator",
      sql.Int,
      bypassCoordinatorApproval ? 1 : 0
    );
    const result = await request.query(`
      UPDATE tb_CILT
      SET
        approval_spv = 1,
        approval_spv_by = @username,
        approval_spv_at = GETDATE(),
        approval_coor = CASE
          WHEN @autoApproveCoordinator = 1 AND ISNULL(approval_coor, 0) <> 1 THEN 1
          ELSE approval_coor
        END,
        approval_coor_by = CASE
          WHEN @autoApproveCoordinator = 1 AND ISNULL(approval_coor, 0) <> 1 THEN @username
          ELSE approval_coor_by
        END,
        approval_coor_at = CASE
          WHEN @autoApproveCoordinator = 1 AND ISNULL(approval_coor, 0) <> 1 THEN GETDATE()
          ELSE approval_coor_at
        END,
        approval = 1,
        updatedAt = GETDATE()
      WHERE id IN (${placeholders.join(", ")})
    `);

    await transaction.commit();
    return {
      success: true,
      message:
        bypassCoordinatorApproval
          ? "Approved by Supervisor (Coordinator auto-approved)"
          : "Approved by Supervisor",
      ids: normalizedIds,
      rowsAffected: result.rowsAffected[0] || 0,
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Error rolling back supervisor batch approval:", rollbackError);
      }
    }
    console.error("Error approving CILT batch by supervisor:", error);
    throw error;
  }
}

async function rejectByIds(ids = [], username, options = {}) {
  let transaction;
  try {
    const normalizedIds = normalizeIdList(ids);
    if (normalizedIds.length === 0) {
      throw new Error("ids is required.");
    }

    if (options.requireApprovalGroup === true) {
      await ensureCompleteApprovalGroupIds(normalizedIds);
    }

    const approvalLevel = normalizeApprovalLevel(options.approvalLevel);
    if (!approvalLevel) {
      throw new Error("Approval level is required for rejection.");
    }

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const stateRows = await ensureExistingIds(transaction, normalizedIds);

    if (
      approvalLevel === "spv" &&
      stateRows.some((row) => Number(row.approval_coor) !== 1)
    ) {
      throw new Error("Waiting for Coordinator approval first");
    }

    const request = transaction.request();
    const placeholders = buildIdPlaceholders(request, normalizedIds, "reject_id");
    const formattedUsername = formatApproverUsername(username, options.approverRole);
    request.input("username", sql.VarChar, formattedUsername);

    const query =
      approvalLevel === "spv"
        ? `
          UPDATE tb_CILT
          SET
            approval_spv = 2,
            approval_spv_by = @username,
            approval_spv_at = GETDATE(),
            approval = 2,
            updatedAt = GETDATE()
          WHERE id IN (${placeholders.join(", ")})
        `
        : `
          UPDATE tb_CILT
          SET
            approval_coor = 2,
            approval_coor_by = @username,
            approval_coor_at = GETDATE(),
            approval = 2,
            updatedAt = GETDATE()
          WHERE id IN (${placeholders.join(", ")})
        `;

    const result = await request.query(query);
    await transaction.commit();
    return {
      success: true,
      message:
        approvalLevel === "spv"
          ? "Rejected by Supervisor"
          : "Rejected by Coordinator",
      ids: normalizedIds,
      rowsAffected: result.rowsAffected[0] || 0,
      approvalLevel,
    };
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Error rolling back CILT rejection batch:", rollbackError);
      }
    }
    console.error("Error rejecting CILT batch:", error);
    throw error;
  }
}

async function getApprovalStatus(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          approval_coor,
          approval_coor_by,
          approval_coor_at,
          approval_spv,
          approval_spv_by,
          approval_spv_at,
          approval
        FROM tb_CILT
        WHERE id = @id
      `);

    return result.recordset[0] || null;
  } catch (error) {
    console.error("Error getting approval status:", error);
    throw error;
  }
}

// Masters for dropdowns
async function getMasterPlant() {
  const pool = await getPool();
  const res = await pool.request().query(`
    SELECT DISTINCT plant 
    FROM tb_CILT 
    WHERE plant IS NOT NULL AND LTRIM(RTRIM(plant)) <> ''
    ORDER BY plant
  `);
  return res.recordset.map(r => r.plant);
}

async function getMasterLine() {
  const pool = await getPool();
  const res = await pool.request().query(`
    SELECT DISTINCT line 
    FROM tb_CILT 
    WHERE line IS NOT NULL AND LTRIM(RTRIM(line)) <> ''
    ORDER BY line
  `);
  return res.recordset.map(r => r.line);
}

async function getMasterPackage() {
  const pool = await getPool();
  const res = await pool.request().query(`
    SELECT DISTINCT packageType 
    FROM tb_CILT 
    WHERE packageType IS NOT NULL AND LTRIM(RTRIM(packageType)) <> ''
    ORDER BY packageType
  `);
  return res.recordset.map(r => r.packageType);
}

module.exports = {
  createCILT,
  getCILT,
  getCILTsByIds,
  getAllCILT,
  updateCILT,
  deleteCILT,
  checkDraft,
  getReportCILTAll,
  getSKU,
  checkCiltByProcessOrder,
  approveByCoor,
  approveBySpv,
  getAllCILTWithFilters,
  getApprovalGroups,
  approveByCoorBatch,
  approveBySpvBatch,
  rejectByIds,
  getApprovalStatus,
  getMasterPlant,
  getMasterLine,
  getMasterPackage,
};
