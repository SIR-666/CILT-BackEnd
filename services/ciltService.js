const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

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
        .input("remarks", order.remarks)
        .input("inspectionData", JSON.stringify(order.inspectionData))
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
      .input("remarks", order.remarks)
      .input("inspectionData", JSON.stringify(order.inspectionData))
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
      .input("inspectionData", sql.NVarChar, JSON.stringify(order.inspectionData))
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
    let query = `SELECT id, sku AS material, category FROM Product`;
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

async function approveByCoor(id, username) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.VarChar, username)
      .query(`
        UPDATE tb_CILT 
        SET 
          approval_coor = 1,
          approval_coor_by = @username,
          approval_coor_at = GETDATE(),
          updatedAt = GETDATE()
        WHERE id = @id AND approval_coor = 0
      `);

    if (result.rowsAffected[0] === 0) {
      throw new Error("Record not found or already approved by coordinator");
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

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.VarChar, username)
      .query(`
        UPDATE tb_CILT 
        SET 
          approval_spv = 1,
          approval_spv_by = @username,
          approval_spv_at = GETDATE(),
          approval = 1,
          updatedAt = GETDATE()
        WHERE id = @id AND approval_spv = 0
      `);

    if (result.rowsAffected[0] === 0) {
      throw new Error("Record already approved by supervisor");
    }

    return { success: true, message: "Approved by Supervisor" };
  } catch (error) {
    console.error("Error approving by supervisor:", error);
    throw error;
  }
}

async function getAllCILTWithFilters(filters) {
  try {
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
    return result.recordset;
  } catch (error) {
    console.error("Error fetching CILT with filters:", error);
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

// ===== Masters for dropdowns =====
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
  getApprovalStatus,
  getMasterPlant,
  getMasterLine,
  getMasterPackage,
};
