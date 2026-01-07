const sql = require("mssql");
const getPool = require("../config/pool");

/**
 * CIP Service - JSON Storage Approach
 * 
 * Master Tables (uppercase CIP) - for fetching templates:
 * - tb_CIP_steps_master
 * - tb_CIP_special_records_master  
 * - tb_CIP_flow_rate_master
 * - tb_CIP_valve_master
 * 
 * Storage Table (lowercase cip) - for saving inspection data:
 * - tb_cip_reports (with JSON columns: steps_data, special_records_data, valve_data)
 */

async function getAllCIPReports(date, plant, line, processOrder, status, cipType, posisi) {
  try {
    const pool = await getPool();

    let query = `
      SELECT 
        id,
        date,
        process_order as processOrder,
        plant,
        line,
        cip_type as cipType,
        status,
        operator,
        posisi,
        flow_rate as flowRate,
        flow_rate_d as flowRateD,
        flow_rate_bc as flowRateBC,
        notes,
        steps_data as stepsData,
        special_records_data as specialRecordsData,
        valve_data as valveData,
        ISNULL(approval_coor, 0) as approval_coor,
        ISNULL(approval_spv, 0) as approval_spv,
        approval_coor_by,
        approval_coor_at,
        approval_spv_by,
        approval_spv_at,
        created_at as createdAt,
        updated_at as updatedAt
      FROM tb_cip_reports
      WHERE 1=1
    `;

    const request = pool.request();

    if (date) {
      query += ` AND CAST(date AS DATE) = @date`;
      request.input("date", sql.Date, date);
    }

    if (plant) {
      query += ` AND plant = @plant`;
      request.input("plant", sql.VarChar, plant);
    }

    if (line) {
      query += ` AND line = @line`;
      request.input("line", sql.VarChar, line);
    }

    if (processOrder) {
      query += ` AND process_order LIKE @processOrder`;
      request.input("processOrder", sql.VarChar, `%${processOrder}%`);
    }

    if (status) {
      query += ` AND status = @status`;
      request.input("status", sql.VarChar, status);
    }

    if (cipType) {
      query += ` AND cip_type = @cipType`;
      request.input("cipType", sql.VarChar, cipType);
    }

    if (posisi) {
      query += ` AND posisi = @posisi`;
      request.input("posisi", sql.VarChar, posisi);
    }

    query += ` ORDER BY date DESC, id DESC`;

    console.log("[getAllCIPReports] Executing query...");
    const result = await request.query(query);

    // Parse JSON fields
    const reports = result.recordset.map(report => ({
      ...report,
      steps: safeJsonParse(report.stepsData, []),
      specialRecords: safeJsonParse(report.specialRecordsData, []),
      valvePositions: safeJsonParse(report.valveData, null),
      // Remove raw JSON strings from response
      stepsData: undefined,
      specialRecordsData: undefined,
      valveData: undefined,
    }));

    console.log("[getAllCIPReports] Found", reports.length, "reports");
    return reports;
  } catch (error) {
    console.error("[getAllCIPReports] Error:", error.message);
    throw error;
  }
}

async function getCIPReportById(id) {
  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          id,
          date,
          process_order as processOrder,
          plant,
          line,
          cip_type as cipType,
          status,
          operator,
          posisi,
          flow_rate as flowRate,
          flow_rate_d as flowRateD,
          flow_rate_bc as flowRateBC,
          notes,
          steps_data as stepsData,
          special_records_data as specialRecordsData,
          valve_data as valveData,
          ISNULL(approval_coor, 0) as approval_coor,
          ISNULL(approval_spv, 0) as approval_spv,
          approval_coor_by,
          approval_coor_at,
          approval_spv_by,
          approval_spv_at,
          created_at as createdAt,
          updated_at as updatedAt
        FROM tb_cip_reports
        WHERE id = @id
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const report = result.recordset[0];
    const isLineA = report.line === 'LINE A';

    // Parse JSON and format response
    const formattedReport = {
      ...report,
      steps: safeJsonParse(report.stepsData, []),
      // Remove raw JSON strings
      stepsData: undefined,
      specialRecordsData: undefined,
      valveData: undefined,
    };

    // Add line-specific data
    const specialData = safeJsonParse(report.specialRecordsData, []);

    if (isLineA) {
      formattedReport.copRecords = specialData;
    } else {
      formattedReport.specialRecords = specialData;
      formattedReport.valvePositions = safeJsonParse(report.valveData, { A: false, B: false, C: false });
      formattedReport.flowRates = {
        flowD: report.flowRateD,
        flowBC: report.flowRateBC
      };
    }

    return formattedReport;
  } catch (error) {
    console.error("[getCIPReportById] Error:", error.message);
    throw error;
  }
}

async function createCIPReport(cipData) {
  try {
    const pool = await getPool();

    console.log("[createCIPReport] Creating report for line:", cipData.line);

    const isLineA = cipData.line === 'LINE A';
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Handle flow rate - could be object or number
    let flowRateValue = null;
    if (cipData.flowRate) {
      flowRateValue = typeof cipData.flowRate === 'object'
        ? parseFloat(cipData.flowRate.flowRateActual) || null
        : parseFloat(cipData.flowRate) || null;
    }

    // Prepare JSON data
    const stepsJson = JSON.stringify(cipData.steps || []);

    // Special records: copRecords for LINE A, specialRecords for LINE B/C/D
    const specialRecordsJson = JSON.stringify(
      isLineA ? (cipData.copRecords || []) : (cipData.specialRecords || [])
    );

    // Valve data only for LINE B/C/D
    const valveJson = isBCDLine ? JSON.stringify(cipData.valvePositions || { A: false, B: false, C: false }) : null;

    const request = pool.request();
    request.input("date", sql.Date, cipData.date || new Date());
    request.input("processOrder", sql.VarChar, cipData.processOrder);
    request.input("plant", sql.VarChar, cipData.plant || "Milk Filling Packing");
    request.input("line", sql.VarChar, cipData.line);
    request.input("cipType", sql.VarChar, cipData.cipType || null);
    request.input("operator", sql.VarChar, cipData.operator || null);
    request.input("posisi", sql.VarChar, cipData.posisi || "Final");
    request.input("notes", sql.NVarChar, cipData.notes || null);
    request.input("status", sql.VarChar, cipData.status || "In Progress");
    request.input("stepsData", sql.NVarChar(sql.MAX), stepsJson);
    request.input("specialRecordsData", sql.NVarChar(sql.MAX), specialRecordsJson);
    request.input("valveData", sql.NVarChar(sql.MAX), valveJson);

    // Flow rates based on line
    if (isLineA) {
      request.input("flowRate", sql.Decimal(10, 2), flowRateValue);
      request.input("flowRateD", sql.Decimal(10, 2), null);
      request.input("flowRateBC", sql.Decimal(10, 2), null);
    } else {
      request.input("flowRate", sql.Decimal(10, 2), null);
      request.input("flowRateD", sql.Decimal(10, 2),
        cipData.flowRates?.flowD || (cipData.line === 'LINE D' ? flowRateValue : null));
      request.input("flowRateBC", sql.Decimal(10, 2),
        cipData.flowRates?.flowBC || (['LINE B', 'LINE C'].includes(cipData.line) ? flowRateValue : null));
    }

    const result = await request.query(`
      INSERT INTO tb_cip_reports (
        date, process_order, plant, line, cip_type, operator, posisi,
        flow_rate, flow_rate_d, flow_rate_bc,
        notes, status,
        steps_data, special_records_data, valve_data,
        created_at, updated_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @date, @processOrder, @plant, @line, @cipType, @operator, @posisi,
        @flowRate, @flowRateD, @flowRateBC,
        @notes, @status,
        @stepsData, @specialRecordsData, @valveData,
        GETDATE(), GETDATE()
      )
    `);

    const cipReportId = result.recordset[0].id;
    console.log("[createCIPReport] Created report ID:", cipReportId);

    return await getCIPReportById(cipReportId);
  } catch (error) {
    console.error("[createCIPReport] Error:", error.message);
    throw error;
  }
}

async function createCIPReportWithCompliance(cipData, calculateComplianceScore) {
  const cipReport = await createCIPReport(cipData);
  const complianceScore = calculateComplianceScore ? calculateComplianceScore(cipReport) : { score: 0, totalChecks: 0, passedChecks: 0 };
  return { cipReport, complianceScore };
}

async function updateCIPReport(id, updateData) {
  try {
    const pool = await getPool();

    console.log("[updateCIPReport] Updating report ID:", id);

    const isLineA = updateData.line === 'LINE A';
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(updateData.line);

    // Handle flow rate
    let flowRateValue = null;
    if (updateData.flowRate) {
      flowRateValue = typeof updateData.flowRate === 'object'
        ? parseFloat(updateData.flowRate.flowRateActual) || null
        : parseFloat(updateData.flowRate) || null;
    }

    // Prepare JSON data
    const stepsJson = JSON.stringify(updateData.steps || []);
    const specialRecordsJson = JSON.stringify(
      isLineA ? (updateData.copRecords || []) : (updateData.specialRecords || [])
    );
    const valveJson = isBCDLine ? JSON.stringify(updateData.valvePositions || { A: false, B: false, C: false }) : null;

    const request = pool.request();
    request.input("id", sql.Int, id);
    request.input("date", sql.Date, updateData.date || new Date());
    request.input("processOrder", sql.VarChar, updateData.processOrder);
    request.input("plant", sql.VarChar, updateData.plant || "Milk Filling Packing");
    request.input("line", sql.VarChar, updateData.line);
    request.input("cipType", sql.VarChar, updateData.cipType || null);
    request.input("operator", sql.VarChar, updateData.operator || null);
    request.input("posisi", sql.VarChar, updateData.posisi || "Final");
    request.input("notes", sql.NVarChar, updateData.notes || null);
    request.input("status", sql.VarChar, updateData.status || "In Progress");
    request.input("stepsData", sql.NVarChar(sql.MAX), stepsJson);
    request.input("specialRecordsData", sql.NVarChar(sql.MAX), specialRecordsJson);
    request.input("valveData", sql.NVarChar(sql.MAX), valveJson);

    if (isLineA) {
      request.input("flowRate", sql.Decimal(10, 2), flowRateValue);
      request.input("flowRateD", sql.Decimal(10, 2), null);
      request.input("flowRateBC", sql.Decimal(10, 2), null);
    } else {
      request.input("flowRate", sql.Decimal(10, 2), null);
      request.input("flowRateD", sql.Decimal(10, 2),
        updateData.flowRates?.flowD || (updateData.line === 'LINE D' ? flowRateValue : null));
      request.input("flowRateBC", sql.Decimal(10, 2),
        updateData.flowRates?.flowBC || (['LINE B', 'LINE C'].includes(updateData.line) ? flowRateValue : null));
    }

    await request.query(`
      UPDATE tb_cip_reports SET
        date = @date,
        process_order = @processOrder,
        plant = @plant,
        line = @line,
        cip_type = @cipType,
        operator = @operator,
        posisi = @posisi,
        flow_rate = @flowRate,
        flow_rate_d = @flowRateD,
        flow_rate_bc = @flowRateBC,
        notes = @notes,
        status = @status,
        steps_data = @stepsData,
        special_records_data = @specialRecordsData,
        valve_data = @valveData,
        updated_at = GETDATE()
      WHERE id = @id
    `);

    console.log("[updateCIPReport] Updated successfully");
    return await getCIPReportById(id);
  } catch (error) {
    console.error("[updateCIPReport] Error:", error.message);
    throw error;
  }
}

async function updateCIPReportWithCompliance(id, updateData, calculateComplianceScore) {
  const cipReport = await updateCIPReport(id, updateData);
  const complianceScore = calculateComplianceScore ? calculateComplianceScore(cipReport) : { score: 0 };
  return { cipReport, complianceScore };
}

async function deleteCIPReport(id) {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input("id", sql.Int, id)
      .query("DELETE FROM tb_cip_reports WHERE id = @id");

    console.log("[deleteCIPReport] Deleted report ID:", id);
    return result.rowsAffected[0] > 0;
  } catch (error) {
    console.error("[deleteCIPReport] Error:", error.message);
    throw error;
  }
}

async function updateApprovalStatus(id, roleId, action, userName, dateNow) {
  try {
    const pool = await getPool();

    const approvalValue = action === "approve" ? 1 : 2;
    let query = "";

    if (roleId === 9) {
      query = `
        UPDATE tb_cip_reports 
        SET approval_spv = @val, approval_spv_by = @userName, approval_spv_at = @dateNow, updated_at = GETDATE() 
        WHERE id = @id
      `;
    } else if (roleId === 11) {
      query = `
        UPDATE tb_cip_reports 
        SET approval_coor = @val, approval_coor_by = @userName, approval_coor_at = @dateNow, updated_at = GETDATE() 
        WHERE id = @id
      `;
    } else {
      throw new Error("Unauthorized role for approval");
    }

    const result = await pool.request()
      .input("val", sql.Int, approvalValue)
      .input("userName", sql.VarChar, userName)
      .input("dateNow", sql.DateTime, dateNow)
      .input("id", sql.Int, id)
      .query(query);

    console.log("[updateApprovalStatus] Updated for ID:", id, "Action:", action);
    return { id, roleId, action, rowsAffected: result.rowsAffected[0] };
  } catch (error) {
    console.error("[updateApprovalStatus] Error:", error.message);
    throw error;
  }
}

// Helper function to safely parse JSON
function safeJsonParse(jsonString, defaultValue) {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn("[safeJsonParse] Failed to parse JSON:", e.message);
    return defaultValue;
  }
}

// DRAFT HANDLING FUNCTIONS   
async function saveDraft({ process_order, line, posisi, plant, payload, locked_by }) {
  const pool = await getPool();

  await pool.request()
    .input("process_order", sql.VarChar, process_order)
    .input("line", sql.VarChar, line)
    .input("posisi", sql.VarChar, posisi || null)
    .input("plant", sql.VarChar, plant || null)
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify(payload))
    .input("locked_by", sql.VarChar, locked_by || "system")
    .query(`
      MERGE tb_CIP_drafts AS t
      USING (SELECT @process_order AS process_order, @line AS line) s
      ON t.process_order = s.process_order AND t.line = s.line
      WHEN MATCHED THEN
        UPDATE SET
          payload = @payload,
          posisi = @posisi,
          plant = @plant,
          locked_by = @locked_by,
          locked_at = GETDATE(),
          updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (process_order, line, posisi, plant, payload, locked_by, locked_at)
        VALUES (@process_order, @line, @posisi, @plant, @payload, @locked_by, GETDATE());
    `);
}

async function getDraft(process_order, line) {
  const pool = await getPool();

  const result = await pool.request()
    .input("process_order", sql.VarChar, process_order)
    .input("line", sql.VarChar, line)
    .query(`
      SELECT * FROM tb_CIP_drafts
      WHERE process_order = @process_order AND line = @line
    `);

  if (!result.recordset.length) return null;

  const draft = result.recordset[0];
  return {
    ...draft,
    payload: safeJsonParse(draft.payload, {})
  };
}

async function clearDraft(process_order, line) {
  const pool = await getPool();

  await pool.request()
    .input("process_order", sql.VarChar, process_order)
    .input("line", sql.VarChar, line)
    .query(`
      DELETE FROM tb_CIP_drafts
      WHERE process_order = @process_order AND line = @line
    `);
}

module.exports = {
  getAllCIPReports,
  getCIPReportById,
  createCIPReport,
  createCIPReportWithCompliance,
  updateCIPReport,
  updateCIPReportWithCompliance,
  deleteCIPReport,
  saveDraft,
  getDraft,
  clearDraft,
  updateApprovalStatus
};