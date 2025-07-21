const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getAllCIPReports(date, plant, line, processOrder, status, cipType) {
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
        cr.flow_rate as flowRate,
        cr.notes,
        cr.created_at as createdAt,
        cr.updated_at as updatedAt
      FROM tb_cip_reports cr
      WHERE 1=1
    `;

    const request = pool.request();

    // Apply filters
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
          cr.flow_rate as flowRate,
          cr.notes,
          cr.created_at as createdAt,
          cr.updated_at as updatedAt
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
          cs.temperature_setpoint as temperatureSetpoint,
          cs.temperature_setpoint_min as temperatureSetpointMin,
          cs.temperature_setpoint_max as temperatureSetpointMax,
          cs.time_setpoint as timeSetpoint,
          cs.concentration,
          cs.start_time as startTime,
          cs.end_time as endTime
        FROM tb_cip_step_records cs
        WHERE cs.cip_report_id = @cipReportId
        ORDER BY cs.step_number
      `);

    // Get COP/SOP/SIP records
    const copResult = await pool
      .request()
      .input("cipReportId", sql.Int, id)
      .query(`
        SELECT 
          cc.id,
          cc.step_type as stepType,
          cc.time_67_min as time67Min,
          cc.time_45_min as time45Min,
          cc.time_60_min as time60Min,
          cc.start_time as startTime,
          cc.end_time as endTime,
          cc.temp_min as tempMin,
          cc.temp_max as tempMax,
          cc.temp_actual as tempActual,
          cc.kode,
          cc.teknisi,
          cc.operator
        FROM tb_cip_cop_records cc
        WHERE cc.cip_report_id = @cipReportId
      `);

    // Format the response
    const formattedReport = {
      ...report,
      steps: stepsResult.recordset,
      copRecords: copResult.recordset
    };

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

    // Insert main CIP report
    const reportRequest = new sql.Request(transaction);
    const reportResult = await reportRequest
      .input("date", sql.Date, cipData.date || new Date())
      .input("processOrder", sql.VarChar, cipData.processOrder)
      .input("plant", sql.VarChar, cipData.plant)
      .input("line", sql.VarChar, cipData.line)
      .input("cipType", sql.VarChar, cipData.cipType)
      .input("status", sql.VarChar, cipData.status || 'In Progress')
      .input("operator", sql.VarChar, cipData.operator)
      .input("flowRate", sql.Decimal(10, 2), cipData.flowRate)
      .input("notes", sql.Text, cipData.notes)
      .query(`
        INSERT INTO tb_cip_reports 
          (date, process_order, plant, line, cip_type, status, operator, flow_rate, notes)
        VALUES 
          (@date, @processOrder, @plant, @line, @cipType, @status, @operator, @flowRate, @notes);
        SELECT SCOPE_IDENTITY() AS id;
      `);

    const cipReportId = reportResult.recordset[0].id;

    // Insert CIP steps if provided
    if (cipData.steps && cipData.steps.length > 0) {
      for (const step of cipData.steps) {
        const stepRequest = new sql.Request(transaction);
        await stepRequest
          .input("cipReportId", sql.Int, cipReportId)
          .input("stepNumber", sql.Int, step.stepNumber)
          .input("stepName", sql.VarChar, step.stepName)
          .input("temperatureSetpoint", sql.Decimal(5, 2), step.temperatureSetpoint)
          .input("temperatureActual", sql.Decimal(5, 2), step.temperatureActual)
          .input("timeSetpoint", sql.Int, step.timeSetpoint)
          .input("timeActual", sql.Int, step.timeActual)
          .input("concentration", sql.Decimal(5, 2), step.concentration)
          .input("startTime", sql.Time, step.startTime)
          .input("endTime", sql.Time, step.endTime)
          .query(`
            INSERT INTO tb_cip_step_records 
              (cip_report_id, step_number, step_name, temperature_setpoint, temperature_actual,
               time_setpoint, time_actual, concentration, start_time, end_time)
            VALUES 
              (@cipReportId, @stepNumber, @stepName, @temperatureSetpoint, @temperatureActual,
               @timeSetpoint, @timeActual, @concentration, @startTime, @endTime)
          `);
      }
    }

    // Insert COP records if provided
    if (cipData.copRecords && cipData.copRecords.length > 0) {
      for (const cop of cipData.copRecords) {
        const copRequest = new sql.Request(transaction);
        await copRequest
          .input("cipReportId", sql.Int, cipReportId)
          .input("stepType", sql.VarChar, cop.stepType)
          .input("time67Min", sql.Int, cop.time67Min)
          .input("time45Min", sql.Int, cop.time45Min)
          .input("time60Min", sql.Int, cop.time60Min)
          .input("startTime", sql.Time, cop.startTime)
          .input("endTime", sql.Time, cop.endTime)
          .input("tempMin", sql.Decimal(5, 2), cop.tempMin)
          .input("tempMax", sql.Decimal(5, 2), cop.tempMax)
          .input("tempActual", sql.Decimal(5, 2), cop.tempActual)
          .input("kode", sql.VarChar, cop.kode)
          .input("teknisi", sql.VarChar, cop.teknisi)
          .input("operator", sql.VarChar, cop.operator)
          .query(`
            INSERT INTO tb_cip_cop_records 
              (cip_report_id, step_type, time_67_min, time_45_min, time_60_min,
               start_time, end_time, temp_min, temp_max, temp_actual, kode, teknisi, operator)
            VALUES 
              (@cipReportId, @stepType, @time67Min, @time45Min, @time60Min,
               @startTime, @endTime, @tempMin, @tempMax, @tempActual, @kode, @teknisi, @operator)
          `);
      }
    }

    await transaction.commit();

    // Return the created report
    return await getCIPReportById(cipReportId);
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating CIP report:", error);
    throw error;
  }
}

async function updateCIPReport(id, updateData) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Build update query dynamically
    const updateFields = [];
    const request = new sql.Request(transaction);
    request.input("id", sql.Int, id);

    if (updateData.date !== undefined) {
      updateFields.push("date = @date");
      request.input("date", sql.Date, updateData.date);
    }
    if (updateData.processOrder !== undefined) {
      updateFields.push("process_order = @processOrder");
      request.input("processOrder", sql.VarChar, updateData.processOrder);
    }
    if (updateData.plant !== undefined) {
      updateFields.push("plant = @plant");
      request.input("plant", sql.VarChar, updateData.plant);
    }
    if (updateData.line !== undefined) {
      updateFields.push("line = @line");
      request.input("line", sql.VarChar, updateData.line);
    }
    if (updateData.cipType !== undefined) {
      updateFields.push("cip_type = @cipType");
      request.input("cipType", sql.VarChar, updateData.cipType);
    }
    if (updateData.status !== undefined) {
      updateFields.push("status = @status");
      request.input("status", sql.VarChar, updateData.status);
    }
    if (updateData.operator !== undefined) {
      updateFields.push("operator = @operator");
      request.input("operator", sql.VarChar, updateData.operator);
    }
    if (updateData.flowRate !== undefined) {
      updateFields.push("flow_rate = @flowRate");
      request.input("flowRate", sql.Decimal(10, 2), updateData.flowRate);
    }
    if (updateData.notes !== undefined) {
      updateFields.push("notes = @notes");
      request.input("notes", sql.Text, updateData.notes);
    }

    if (updateFields.length > 0) {
      updateFields.push("updated_at = GETDATE()");
      await request.query(`
        UPDATE tb_cip_reports 
        SET ${updateFields.join(', ')} 
        WHERE id = @id
      `);
    }

    // Update steps if provided
    if (updateData.steps) {
      // Delete existing steps
      const deleteStepsRequest = new sql.Request(transaction);
      await deleteStepsRequest
        .input("cipReportId", sql.Int, id)
        .query("DELETE FROM tb_cip_step_records WHERE cip_report_id = @cipReportId");

      // Insert new steps
      if (updateData.steps.length > 0) {
        for (const step of updateData.steps) {
          const stepRequest = new sql.Request(transaction);
          await stepRequest
            .input("cipReportId", sql.Int, id)
            .input("stepNumber", sql.Int, step.stepNumber)
            .input("stepName", sql.VarChar, step.stepName)
            .input("temperatureSetpoint", sql.Decimal(5, 2), step.temperatureSetpoint)
            .input("temperatureActual", sql.Decimal(5, 2), step.temperatureActual)
            .input("timeSetpoint", sql.Int, step.timeSetpoint)
            .input("timeActual", sql.Int, step.timeActual)
            .input("concentration", sql.Decimal(5, 2), step.concentration)
            .input("startTime", sql.Time, step.startTime)
            .input("endTime", sql.Time, step.endTime)
            .query(`
              INSERT INTO tb_cip_step_records 
                (cip_report_id, step_number, step_name, temperature_setpoint, temperature_actual,
                 time_setpoint, time_actual, concentration, start_time, end_time)
              VALUES 
                (@cipReportId, @stepNumber, @stepName, @temperatureSetpoint, @temperatureActual,
                 @timeSetpoint, @timeActual, @concentration, @startTime, @endTime)
            `);
        }
      }
    }

    // Update COP records if provided
    if (updateData.copRecords) {
      // Delete existing COP records
      const deleteCopRequest = new sql.Request(transaction);
      await deleteCopRequest
        .input("cipReportId", sql.Int, id)
        .query("DELETE FROM tb_cip_cop_records WHERE cip_report_id = @cipReportId");

      // Insert new COP records
      if (updateData.copRecords.length > 0) {
        for (const cop of updateData.copRecords) {
          const copRequest = new sql.Request(transaction);
          await copRequest
            .input("cipReportId", sql.Int, id)
            .input("stepType", sql.VarChar, cop.stepType)
            .input("time67Min", sql.Int, cop.time67Min)
            .input("time45Min", sql.Int, cop.time45Min)
            .input("time60Min", sql.Int, cop.time60Min)
            .input("startTime", sql.Time, cop.startTime)
            .input("endTime", sql.Time, cop.endTime)
            .input("tempMin", sql.Decimal(5, 2), cop.tempMin)
            .input("tempMax", sql.Decimal(5, 2), cop.tempMax)
            .input("tempActual", sql.Decimal(5, 2), cop.tempActual)
            .input("kode", sql.VarChar, cop.kode)
            .input("teknisi", sql.VarChar, cop.teknisi)
            .input("operator", sql.VarChar, cop.operator)
            .query(`
              INSERT INTO tb_cip_cop_records 
                (cip_report_id, step_type, time_67_min, time_45_min, time_60_min,
                 start_time, end_time, temp_min, temp_max, temp_actual, kode, teknisi, operator)
              VALUES 
                (@cipReportId, @stepType, @time67Min, @time45Min, @time60Min,
                 @startTime, @endTime, @tempMin, @tempMax, @tempActual, @kode, @teknisi, @operator)
            `);
        }
      }
    }

    await transaction.commit();

    // Return the updated report
    return await getCIPReportById(id);
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating CIP report:", error);
    throw error;
  }
}

async function deleteCIPReport(id) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Delete related records first (steps and COP records)
    const deleteStepsRequest = new sql.Request(transaction);
    await deleteStepsRequest
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_step_records WHERE cip_report_id = @cipReportId");

    const deleteCopRequest = new sql.Request(transaction);
    await deleteCopRequest
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_cop_records WHERE cip_report_id = @cipReportId");

    // Delete the main CIP report
    const deleteReportRequest = new sql.Request(transaction);
    const result = await deleteReportRequest
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

async function getCIPTypes() {
  try {
    const cipTypes = [
      { id: 1, name: "Full CIP", description: "Complete cleaning process with all steps" },
      { id: 2, name: "Rinse CIP", description: "Rinse only process" },
      { id: 3, name: "Sanitize CIP", description: "Sanitization process" },
      { id: 4, name: "Acid CIP", description: "Acid cleaning process" },
      { id: 5, name: "Alkaline CIP", description: "Alkaline cleaning process" },
      { id: 6, name: "COP/SOP/SIP", description: "Clean/Sterilize Out of Place and In Place" }
    ];

    return cipTypes;
  } catch (error) {
    console.error("Error fetching CIP types:", error);
    throw error;
  }
}

async function getCIPStatusList() {
  try {
    const statusList = [
      { id: 1, name: "In Progress", color: "#FFA500" },
      { id: 2, name: "Complete", color: "#00FF00" },
      { id: 3, name: "Failed", color: "#FF0000" },
      { id: 4, name: "Pending", color: "#808080" },
      { id: 5, name: "Cancelled", color: "#FF0000" }
    ];

    return statusList;
  } catch (error) {
    console.error("Error fetching CIP status list:", error);
    throw error;
  }
}

async function getCIPStepTemplates() {
  try {
    const templates = {
      "Full CIP": [
        { stepNumber: 1, stepName: "COLD RINSE", temperatureSetpoint: 25, timeSetpoint: 8 },
        { stepNumber: 2, stepName: "WARM RINSE", temperatureSetpoint: 80, timeSetpoint: 8 },
        { stepNumber: 3, stepName: "ALKALI", temperatureSetpoint: 80, timeSetpoint: 24, concentration: 2.0 },
        { stepNumber: 4, stepName: "WARM RINSE", temperatureSetpoint: 35, timeSetpoint: 8 },
        { stepNumber: 5, stepName: "COLD RINSE", temperatureSetpoint: 70, timeSetpoint: 16 },
        { stepNumber: 6, stepName: "ACID", temperatureSetpoint: 70, timeSetpoint: 16, concentration: 1.0 },
        { stepNumber: 7, stepName: "WARM RINSE", temperatureSetpoint: 80, timeSetpoint: 16 },
        { stepNumber: 8, stepName: "COLD RINSE", temperatureSetpoint: 35, timeSetpoint: 8 }
      ],
      "Rinse CIP": [
        { stepNumber: 1, stepName: "COLD RINSE", temperatureSetpoint: 25, timeSetpoint: 10 },
        { stepNumber: 2, stepName: "WARM RINSE", temperatureSetpoint: 60, timeSetpoint: 10 },
        { stepNumber: 3, stepName: "COLD RINSE", temperatureSetpoint: 25, timeSetpoint: 10 }
      ]
    };

    return templates;
  } catch (error) {
    console.error("Error fetching CIP step templates:", error);
    throw error;
  }
}

module.exports = {
  getAllCIPReports,
  getCIPReportById,
  createCIPReport,
  updateCIPReport,
  deleteCIPReport,
  getCIPTypes,
  getCIPStatusList,
  getCIPStepTemplates
};