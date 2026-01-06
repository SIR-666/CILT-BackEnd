const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getAllCIPReports(date, plant, line, processOrder, status, cipType, posisi) {
  try {
    const pool = await getPool();
    let query = `
      SELECT 
        cr.id,
        cr.date,
        cr.process_order as processOrder,
        cr.plant,
        cr.line,
        cr.cip_type as cipType,
        cr.status,
        cr.operator,
        cr.posisi,
        cr.flow_rate as flowRate,
        cr.flow_rate_d as flowRateD,
        cr.flow_rate_bc as flowRateBC,
        cr.notes,
        ISNULL(cr.approval_coor, 0) as approval_coor,
        ISNULL(cr.approval_spv, 0) as approval_spv,
        cr.approval_coor_by,
        cr.approval_coor_at,
        cr.approval_spv_by,
        cr.approval_spv_at,
        cr.created_at as createdAt,
        cr.updated_at as updatedAt,
        cr.created_by as createdBy
      FROM tb_cip_reports cr
      WHERE 1=1
    `;

    const request = pool.request();

    if (date) {
      query += ` AND CAST(cr.date AS DATE) = @date`;
      request.input("date", sql.Date, date);
    }

    if (plant) {
      query += ` AND cr.plant = @plant`;
      request.input("plant", sql.VarChar, plant);
    }

    if (line) {
      query += ` AND cr.line = @line`;
      request.input("line", sql.VarChar, line);
    }

    if (processOrder) {
      query += ` AND cr.process_order LIKE @processOrder`;
      request.input("processOrder", sql.VarChar, `%${processOrder}%`);
    }

    if (status) {
      query += ` AND cr.status = @status`;
      request.input("status", sql.VarChar, status);
    }

    if (cipType) {
      query += ` AND cr.cip_type = @cipType`;
      request.input("cipType", sql.VarChar, cipType);
    }

    if (posisi) {
      query += ` AND cr.posisi = @posisi`;
      request.input("posisi", sql.VarChar, posisi);
    }

    query += ` ORDER BY cr.date DESC, cr.id DESC`;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    console.error("Error fetching all CIP reports:", error);
    throw error;
  }
}

async function getCIPReportById(id) {
  try {
    const pool = await getPool();

    // Get main CIP report
    const reportResult = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          cr.id,
          cr.date,
          cr.process_order as processOrder,
          cr.plant,
          cr.line,
          cr.cip_type as cipType,
          cr.status,
          cr.operator,
          cr.posisi,
          cr.flow_rate as flowRate,
          cr.flow_rate_d as flowRateD,
          cr.flow_rate_bc as flowRateBC,
          cr.valve_a_status,
          cr.valve_b_status,
          cr.valve_c_status,
          cr.notes,
          ISNULL(cr.approval_coor, 0) as approval_coor,
          ISNULL(cr.approval_spv, 0) as approval_spv,
          cr.approval_coor_by,
          cr.approval_coor_at,
          cr.approval_spv_by,
          cr.approval_spv_at,
          cr.created_at as createdAt,
          cr.updated_at as updatedAt,
          cr.created_by as createdBy
        FROM tb_cip_reports cr
        WHERE cr.id = @id
      `);

    if (reportResult.recordset.length === 0) {
      return null;
    }

    const report = reportResult.recordset[0];

    // Get CIP steps
    const stepsResult = await pool
      .request()
      .input("cipReportId", sql.Int, id)
      .query(`
        SELECT 
          cs.id,
          cs.step_number as stepNumber,
          cs.step_name as stepName,
          cs.temperature_setpoint_min as temperatureSetpointMin,
          cs.temperature_setpoint_max as temperatureSetpointMax,
          cs.temperature_actual as temperatureActual,
          cs.time_setpoint as timeSetpoint,
          cs.time_actual as timeActual,
          cs.concentration as concentration,
          cs.concentration_actual as concentrationActual,
          cs.start_time as startTime,
          cs.end_time as endTime
        FROM tb_cip_step_records cs
        WHERE cs.cip_report_id = @cipReportId
        ORDER BY cs.step_number
      `);

    // Format the response based on LINE
    const formattedReport = {
      ...report,
      steps: stepsResult.recordset,
    };

    // For LINE A, get COP/SOP/SIP records
    if (report.line === 'LINE A') {
      const copResult = await pool
        .request()
        .input("cipReportId", sql.Int, id)
        .query(`
          SELECT 
            cc.id,
            cc.step_type as stepType,
            cc.time_minutes as time,
            cc.start_time as startTime,
            cc.end_time as endTime,
            cc.temp_min as tempMin,
            cc.temp_max as tempMax,
            cc.temp_actual as tempActual
          FROM tb_cip_cop_records cc
          WHERE cc.cip_report_id = @cipReportId
          ORDER BY 
            CASE cc.step_type 
              WHEN 'COP' THEN 1
              WHEN 'SOP' THEN 2
              WHEN 'SIP' THEN 3
            END
        `);

      formattedReport.copRecords = copResult.recordset;
    }
    // For LINE B/C/D, get special records and valve positions
    else if (['LINE B', 'LINE C', 'LINE D'].includes(report.line)) {
      const specialResult = await pool
        .request()
        .input("cipReportId", sql.Int, id)
        .query(`
          SELECT 
            cs.id,
            cs.step_type as stepType,
            cs.temp_min as tempMin,
            cs.temp_max as tempMax,
            cs.temp_actual as tempActual,
            cs.temp_bc as tempBC,
            cs.temp_d_min as tempDMin,
            cs.temp_d_max as tempDMax,
            cs.conc_min as concMin,
            cs.conc_max as concMax,
            cs.conc_actual as concActual,
            cs.time_minutes as time,
            cs.start_time as startTime,
            cs.end_time as endTime
          FROM tb_cip_special_records cs
          WHERE cs.cip_report_id = @cipReportId
          ORDER BY 
            CASE cs.step_type 
              WHEN 'DRYING' THEN 1
              WHEN 'FOAMING' THEN 2
              WHEN 'DISINFECT/SANITASI' THEN 3
            END
        `);

      formattedReport.specialRecords = specialResult.recordset;
      formattedReport.valvePositions = {
        A: report.valve_a_status,
        B: report.valve_b_status,
        C: report.valve_c_status
      };
      formattedReport.flowRates = {
        flowD: report.flowRateD,
        flowBC: report.flowRateBC
      };
    }

    return formattedReport;
  } catch (error) {
    console.error("Error fetching CIP report by ID:", error);
    throw error;
  }
}

async function createCIPReport(cipData) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Insert main CIP report (tanpa kodeOperator dan kodeTeknisi)
    console.log("Inserting main CIP report...");
    const reportRequest = new sql.Request(transaction);

    reportRequest
      .input("date", sql.Date, cipData.date || new Date())
      .input("processOrder", sql.VarChar, cipData.processOrder)
      .input("plant", sql.VarChar, cipData.plant)
      .input("line", sql.VarChar, cipData.line)
      .input("cipType", sql.VarChar, cipData.cipType || null)
      .input("operator", sql.VarChar, cipData.operator || null)
      .input("posisi", sql.VarChar, cipData.posisi || null)
      .input("notes", sql.VarChar, cipData.notes || null)
      .input("status", sql.VarChar, cipData.status || 'In Progress')
      .input("createdBy", sql.VarChar, cipData.createdBy || cipData.operator || null);

    // Add flow rate based on line
    if (isBCDLine) {
      if (cipData.line === 'LINE D') {
        reportRequest.input("flowRateD", sql.Float, cipData.flowRateD || null);
        reportRequest.input("flowRateBC", sql.Float, null);
      } else {
        reportRequest.input("flowRateBC", sql.Float, cipData.flowRateBC || null);
        reportRequest.input("flowRateD", sql.Float, null);
      }
      reportRequest.input("flowRate", sql.Float, null);
      
      // Valve positions
      reportRequest.input("valveA", sql.Bit, cipData.valvePositions?.A || false);
      reportRequest.input("valveB", sql.Bit, cipData.valvePositions?.B || false);
      reportRequest.input("valveC", sql.Bit, cipData.valvePositions?.C || false);
    } else {
      reportRequest.input("flowRate", sql.Float, cipData.flowRate || null);
      reportRequest.input("flowRateD", sql.Float, null);
      reportRequest.input("flowRateBC", sql.Float, null);
      reportRequest.input("valveA", sql.Bit, null);
      reportRequest.input("valveB", sql.Bit, null);
      reportRequest.input("valveC", sql.Bit, null);
    }

    const insertReportQuery = `
      INSERT INTO tb_cip_reports (
        date, process_order, plant, line, cip_type, 
        operator, posisi, flow_rate, flow_rate_d, flow_rate_bc,
        valve_a_status, valve_b_status, valve_c_status,
        notes, status, created_by, created_at, updated_at
      )
      OUTPUT INSERTED.id
      VALUES (
        @date, @processOrder, @plant, @line, @cipType,
        @operator, @posisi, @flowRate, @flowRateD, @flowRateBC,
        @valveA, @valveB, @valveC,
        @notes, @status, @createdBy, GETDATE(), GETDATE()
      )
    `;

    const reportResult = await reportRequest.query(insertReportQuery);
    const cipReportId = reportResult.recordset[0].id;
    console.log("Created CIP report with ID:", cipReportId);

    // Insert CIP steps
    if (cipData.steps && cipData.steps.length > 0) {
      console.log("Inserting CIP steps...");
      for (const step of cipData.steps) {
        const stepRequest = new sql.Request(transaction);
        await stepRequest
          .input("cipReportId", sql.Int, cipReportId)
          .input("stepNumber", sql.Int, step.stepNumber)
          .input("stepName", sql.VarChar, step.stepName)
          .input("temperatureSetpointMin", sql.Float, step.temperatureSetpointMin || null)
          .input("temperatureSetpointMax", sql.Float, step.temperatureSetpointMax || null)
          .input("temperatureActual", sql.Float, step.temperatureActual || null)
          .input("timeSetpoint", sql.Int, step.timeSetpoint || null)
          .input("timeActual", sql.Int, step.timeActual || null)
          .input("concentration", sql.Float, step.concentration || null)
          .input("concentrationActual", sql.Float, step.concentrationActual || null)
          .input("startTime", sql.VarChar, step.startTime || null)
          .input("endTime", sql.VarChar, step.endTime || null)
          .query(`
            INSERT INTO tb_cip_step_records (
              cip_report_id, step_number, step_name,
              temperature_setpoint_min, temperature_setpoint_max, temperature_actual,
              time_setpoint, time_actual, concentration, concentration_actual,
              start_time, end_time
            )
            VALUES (
              @cipReportId, @stepNumber, @stepName,
              @temperatureSetpointMin, @temperatureSetpointMax, @temperatureActual,
              @timeSetpoint, @timeActual, @concentration, @concentrationActual,
              @startTime, @endTime
            )
          `);
      }
    }

    // Insert line-specific records
    if (cipData.line === 'LINE A' && cipData.copRecords && cipData.copRecords.length > 0) {
      // Insert COP/SOP/SIP records with unified `time` field
      console.log("Inserting COP records...");
      for (const cop of cipData.copRecords) {
        const copRequest = new sql.Request(transaction);
        await copRequest
          .input("cipReportId", sql.Int, cipReportId)
          .input("stepType", sql.VarChar, cop.stepType)
          .input("time", sql.Int, cop.time || null)
          .input("startTime", sql.VarChar, cop.startTime || null)
          .input("endTime", sql.VarChar, cop.endTime || null)
          .input("tempMin", sql.Float, cop.tempMin || 105)
          .input("tempMax", sql.Float, cop.tempMax || 128)
          .input("tempActual", sql.Float, cop.tempActual || null)
          .query(`
            INSERT INTO tb_cip_cop_records (
              cip_report_id, step_type, time_minutes,
              start_time, end_time, temp_min, temp_max, temp_actual
            )
            VALUES (
              @cipReportId, @stepType, @time,
              @startTime, @endTime, @tempMin, @tempMax, @tempActual
            )
          `);
      }
    } else if (isBCDLine && cipData.specialRecords && cipData.specialRecords.length > 0) {
      // Insert special records
      console.log("Inserting special records...");
      for (const record of cipData.specialRecords) {
        const specialRequest = new sql.Request(transaction);
        await specialRequest
          .input("cipReportId", sql.Int, cipReportId)
          .input("stepType", sql.VarChar, record.stepType)
          .input("time", sql.Int, record.time || null)
          .input("tempMin", sql.Float, record.tempMin || null)
          .input("tempMax", sql.Float, record.tempMax || null)
          .input("tempActual", sql.Float, record.tempActual || null)
          .input("tempBC", sql.Float, record.tempBC || null)
          .input("tempDMin", sql.Float, record.tempDMin || null)
          .input("tempDMax", sql.Float, record.tempDMax || null)
          .input("concMin", sql.Float, record.concMin || null)
          .input("concMax", sql.Float, record.concMax || null)
          .input("concActual", sql.Float, record.concActual || null)
          .input("startTime", sql.VarChar, record.startTime || null)
          .input("endTime", sql.VarChar, record.endTime || null)
          .query(`
            INSERT INTO tb_cip_special_records (
              cip_report_id, step_type, time_minutes,
              temp_min, temp_max, temp_actual,
              temp_bc, temp_d_min, temp_d_max,
              conc_min, conc_max, conc_actual,
              start_time, end_time
            )
            VALUES (
              @cipReportId, @stepType, @time,
              @tempMin, @tempMax, @tempActual,
              @tempBC, @tempDMin, @tempDMax,
              @concMin, @concMax, @concActual,
              @startTime, @endTime
            )
          `);
      }
    }

    await transaction.commit();
    console.log("Transaction committed successfully");

    // Return the created report
    return await getCIPReportById(cipReportId);
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating CIP report:", error);
    throw error;
  }
}

async function createCIPReportWithCompliance(cipData, calculateComplianceScore) {
  const cipReport = await createCIPReport(cipData);
  const complianceScore = calculateComplianceScore(cipReport);
  return { cipReport, complianceScore };
}

async function updateCIPReport(id, updateData) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(updateData.line);

    // Update main CIP report
    const reportRequest = new sql.Request(transaction);
    reportRequest
      .input("id", sql.Int, id)
      .input("date", sql.Date, updateData.date || new Date())
      .input("processOrder", sql.VarChar, updateData.processOrder)
      .input("plant", sql.VarChar, updateData.plant)
      .input("line", sql.VarChar, updateData.line)
      .input("cipType", sql.VarChar, updateData.cipType || null)
      .input("operator", sql.VarChar, updateData.operator || null)
      .input("posisi", sql.VarChar, updateData.posisi || null)
      .input("notes", sql.VarChar, updateData.notes || null)
      .input("status", sql.VarChar, updateData.status || 'In Progress');

    // Add flow rate based on line
    if (isBCDLine) {
      if (updateData.line === 'LINE D') {
        reportRequest.input("flowRateD", sql.Float, updateData.flowRateD || null);
        reportRequest.input("flowRateBC", sql.Float, null);
      } else {
        reportRequest.input("flowRateBC", sql.Float, updateData.flowRateBC || null);
        reportRequest.input("flowRateD", sql.Float, null);
      }
      reportRequest.input("flowRate", sql.Float, null);
      
      reportRequest.input("valveA", sql.Bit, updateData.valvePositions?.A || false);
      reportRequest.input("valveB", sql.Bit, updateData.valvePositions?.B || false);
      reportRequest.input("valveC", sql.Bit, updateData.valvePositions?.C || false);
    } else {
      reportRequest.input("flowRate", sql.Float, updateData.flowRate || null);
      reportRequest.input("flowRateD", sql.Float, null);
      reportRequest.input("flowRateBC", sql.Float, null);
      reportRequest.input("valveA", sql.Bit, null);
      reportRequest.input("valveB", sql.Bit, null);
      reportRequest.input("valveC", sql.Bit, null);
    }

    await reportRequest.query(`
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
        valve_a_status = @valveA,
        valve_b_status = @valveB,
        valve_c_status = @valveC,
        notes = @notes,
        status = @status,
        updated_at = GETDATE()
      WHERE id = @id
    `);

    // Delete existing step records and re-insert
    await new sql.Request(transaction)
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_step_records WHERE cip_report_id = @cipReportId");

    // Insert CIP steps
    if (updateData.steps && updateData.steps.length > 0) {
      for (const step of updateData.steps) {
        const stepRequest = new sql.Request(transaction);
        await stepRequest
          .input("cipReportId", sql.Int, id)
          .input("stepNumber", sql.Int, step.stepNumber)
          .input("stepName", sql.VarChar, step.stepName)
          .input("temperatureSetpointMin", sql.Float, step.temperatureSetpointMin || null)
          .input("temperatureSetpointMax", sql.Float, step.temperatureSetpointMax || null)
          .input("temperatureActual", sql.Float, step.temperatureActual || null)
          .input("timeSetpoint", sql.Int, step.timeSetpoint || null)
          .input("timeActual", sql.Int, step.timeActual || null)
          .input("concentration", sql.Float, step.concentration || null)
          .input("concentrationActual", sql.Float, step.concentrationActual || null)
          .input("startTime", sql.VarChar, step.startTime || null)
          .input("endTime", sql.VarChar, step.endTime || null)
          .query(`
            INSERT INTO tb_cip_step_records (
              cip_report_id, step_number, step_name,
              temperature_setpoint_min, temperature_setpoint_max, temperature_actual,
              time_setpoint, time_actual, concentration, concentration_actual,
              start_time, end_time
            )
            VALUES (
              @cipReportId, @stepNumber, @stepName,
              @temperatureSetpointMin, @temperatureSetpointMax, @temperatureActual,
              @timeSetpoint, @timeActual, @concentration, @concentrationActual,
              @startTime, @endTime
            )
          `);
      }
    }

    // Delete and re-insert line-specific records
    await new sql.Request(transaction)
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_cop_records WHERE cip_report_id = @cipReportId");

    await new sql.Request(transaction)
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_special_records WHERE cip_report_id = @cipReportId");

    if (updateData.line === 'LINE A' && updateData.copRecords && updateData.copRecords.length > 0) {
      for (const cop of updateData.copRecords) {
        const copRequest = new sql.Request(transaction);
        await copRequest
          .input("cipReportId", sql.Int, id)
          .input("stepType", sql.VarChar, cop.stepType)
          .input("time", sql.Int, cop.time || null)
          .input("startTime", sql.VarChar, cop.startTime || null)
          .input("endTime", sql.VarChar, cop.endTime || null)
          .input("tempMin", sql.Float, cop.tempMin || 105)
          .input("tempMax", sql.Float, cop.tempMax || 128)
          .input("tempActual", sql.Float, cop.tempActual || null)
          .query(`
            INSERT INTO tb_cip_cop_records (
              cip_report_id, step_type, time_minutes,
              start_time, end_time, temp_min, temp_max, temp_actual
            )
            VALUES (
              @cipReportId, @stepType, @time,
              @startTime, @endTime, @tempMin, @tempMax, @tempActual
            )
          `);
      }
    } else if (isBCDLine && updateData.specialRecords && updateData.specialRecords.length > 0) {
      for (const record of updateData.specialRecords) {
        const specialRequest = new sql.Request(transaction);
        await specialRequest
          .input("cipReportId", sql.Int, id)
          .input("stepType", sql.VarChar, record.stepType)
          .input("time", sql.Int, record.time || null)
          .input("tempMin", sql.Float, record.tempMin || null)
          .input("tempMax", sql.Float, record.tempMax || null)
          .input("tempActual", sql.Float, record.tempActual || null)
          .input("tempBC", sql.Float, record.tempBC || null)
          .input("tempDMin", sql.Float, record.tempDMin || null)
          .input("tempDMax", sql.Float, record.tempDMax || null)
          .input("concMin", sql.Float, record.concMin || null)
          .input("concMax", sql.Float, record.concMax || null)
          .input("concActual", sql.Float, record.concActual || null)
          .input("startTime", sql.VarChar, record.startTime || null)
          .input("endTime", sql.VarChar, record.endTime || null)
          .query(`
            INSERT INTO tb_cip_special_records (
              cip_report_id, step_type, time_minutes,
              temp_min, temp_max, temp_actual,
              temp_bc, temp_d_min, temp_d_max,
              conc_min, conc_max, conc_actual,
              start_time, end_time
            )
            VALUES (
              @cipReportId, @stepType, @time,
              @tempMin, @tempMax, @tempActual,
              @tempBC, @tempDMin, @tempDMax,
              @concMin, @concMax, @concActual,
              @startTime, @endTime
            )
          `);
      }
    }

    await transaction.commit();

    return await getCIPReportById(id);
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating CIP report:", error);
    throw error;
  }
}

async function updateCIPReportWithCompliance(id, updateData, calculateComplianceScore) {
  const cipReport = await updateCIPReport(id, updateData);
  const complianceScore = calculateComplianceScore(cipReport);
  return { cipReport, complianceScore };
}

async function deleteCIPReport(id) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Delete related records first
    await new sql.Request(transaction)
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_step_records WHERE cip_report_id = @cipReportId");

    await new sql.Request(transaction)
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_cop_records WHERE cip_report_id = @cipReportId");

    await new sql.Request(transaction)
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_special_records WHERE cip_report_id = @cipReportId");

    // Delete the main CIP report
    const result = await new sql.Request(transaction)
      .input("id", sql.Int, id)
      .query("DELETE FROM tb_cip_reports WHERE id = @id");

    await transaction.commit();

    return result.rowsAffected[0] > 0;
  } catch (error) {
    await transaction.rollback();
    console.error("Error deleting CIP report:", error);
    throw error;
  }
}

async function updateApprovalStatus(id, roleId, action, userName, dateNow) {
  const pool = await getPool();

  try {
    const approvalValue = action === "approve" ? 1 : 2;
    let query = "";
    
    if (roleId === 9) {
      query = `
        UPDATE tb_cip_reports
        SET approval_spv = @approvalValue,
            approval_spv_by = @userName,
            approval_spv_at = @dateNow,
            updated_at = GETDATE()
        WHERE id = @id
      `;
    } else if (roleId === 11) {
      query = `
        UPDATE tb_cip_reports
        SET approval_coor = @approvalValue,
            approval_coor_by = @userName,
            approval_coor_at = @dateNow,
            updated_at = GETDATE()
        WHERE id = @id
      `;
    } else {
      throw new Error("Unauthorized role for approval");
    }

    const result = await pool.request()
      .input("approvalValue", sql.Int, approvalValue)
      .input("userName", sql.VarChar, userName)
      .input("dateNow", sql.DateTime, dateNow)
      .input("id", sql.Int, id)
      .query(query);

    return { id, roleId, action, userName, approvalValue, rowsAffected: result.rowsAffected[0] };
  } catch (error) {
    console.error("Error updating approval status:", error);
    throw error;
  }
}

module.exports = {
  getAllCIPReports,
  getCIPReportById,
  createCIPReport,
  createCIPReportWithCompliance,
  updateCIPReport,
  updateCIPReportWithCompliance,
  deleteCIPReport,
  updateApprovalStatus
};