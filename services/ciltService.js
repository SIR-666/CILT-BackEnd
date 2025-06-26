const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function createCILT(order) {
  try {
    const pool = await getPool();

    // 1. Check if processOrder exists
    const checkResult = await pool
      .request()
      .input("processOrder", order.processOrder)
      .query(
        "SELECT id FROM tb_CILT WHERE processOrder = @processOrder AND packageType != 'PERFORMA RED AND GREEN'"
      );

    const exists = checkResult.recordset.length > 0;

    // 2. If exists, do UPDATE
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
            status = @status
          WHERE id = @id
        `);

      console.log("Record updated with id:", id);
      return { ...order, id };
    }

    // 3. Else, INSERT new
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
    console.log("New record inserted with id:", newId);
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
      .input("date", order.date ? order.date : null) // Handle null date
      .input("shift", sql.VarChar, order.shift)
      .input("product", sql.VarChar, order.product)
      .input("machine", sql.VarChar, order.machine)
      .input("batch", sql.VarChar, order.batch)
      .input("remarks", sql.NVarChar(sql.MAX), order.remarks)
      .input(
        "inspectionData",
        sql.NVarChar,
        JSON.stringify(order.inspectionData)
      ) // Store inspectionData as a JSON string
      .input("formOpenTime", order.formOpenTime) // Ensure proper date handling
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

    return result.rowsAffected[0]; // Return the number of rows updated
  } catch (err) {
    console.error("Error updating CILT record:", err);
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
  }
}

async function getReportCILTAll(
  packageType,
  plant,
  line,
  shift,
  machine,
  date
) {
  try {
    const pool = await getPool();

    // Format tanggal sesuai kebutuhan query utama
    const formattedDate = date.replace(/-/g, ""); // Format date to 'YYYYMMDD'

    const query = `
      SELECT 
          DATEPART(HOUR, date) AS HourGroup, -- Extract the hour only from date
          COUNT(*) AS RecordCount, -- Count of records per hour
          MAX(date) AS LastRecordTime, -- Most recent date in the hour group
          submitTime,
          packageType, 
          plant, 
          line, 
          shift, 
          machine, 
          STUFF((
              SELECT ', ' + inspectionData
              FROM tb_CILT sub
              WHERE 
                  sub.packageType = tc.packageType
                  AND sub.plant = tc.plant
                  AND sub.line = tc.line
                  AND sub.shift = tc.shift
                  AND sub.machine = tc.machine
                  AND CONVERT(VARCHAR, sub.date, 112) = @formattedDate -- Match the main query date filter
                  AND DATEPART(HOUR, sub.date) = DATEPART(HOUR, tc.date) -- Match the hour group
              FOR XML PATH(''), TYPE
          ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS CombinedInspectionData -- Combine inspectionData
      FROM tb_CILT tc
      WHERE 
          packageType = @packageType
          AND plant = @plant
          AND line = @line
          AND shift = @shift
          AND machine = @machine
          AND CONVERT(VARCHAR, date, 112) = @formattedDate -- Filter by date in 'YYYYMMDD' format
      GROUP BY 
          DATEPART(HOUR, date),
          submitTime, 
          packageType, 
          plant, 
          line, 
          shift, 
          machine
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

async function getSKU(plant) {
  try {
    const pool = await getPool();
    const products = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .query(
        `select id, plant, material, line from ProductDummy where plant = @plant`
      );
    return products.recordsets;
  } catch (error) {
    console.log(error);
  }
}

async function checkCiltByProcessOrder(processOrder) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("processOrder", sql.VarChar, processOrder)
      .query("SELECT * FROM tb_CILT WHERE processOrder = @processOrder");

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
};
