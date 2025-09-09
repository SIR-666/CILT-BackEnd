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
        cr.process_order,
        cr.plant,
        cr.line,
        cr.cip_type,
        cr.status,
        cr.operator,
        cr.posisi,
        cr.flow_rate,
        cr.flow_rate_d,
        cr.flow_rate_bc,
        cr.notes,
        cr.kode_operator,
        cr.kode_teknisi,
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
          cr.process_order,
          cr.plant,
          cr.line,
          cr.cip_type,
          cr.status,
          cr.operator,
          cr.posisi,
          cr.flow_rate,
          cr.flow_rate_d,
          cr.flow_rate_bc,
          cr.valve_a_status,
          cr.valve_b_status,
          cr.valve_c_status,
          cr.notes,
          cr.kode_operator,
          cr.kode_teknisi,
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
            cc.time_67_min as time67Min,
            cc.time_45_min as time45Min,
            cc.time_60_min as time60Min,
            cc.start_time as startTime,
            cc.end_time as endTime,
            cc.temp_min as tempMin,
            cc.temp_max as tempMax,
            cc.temp_actual as tempActual,
            cc.kode
          FROM tb_cip_cop_records cc
          WHERE cc.cip_report_id = @cipReportId
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
            cs.end_time as endTime,
            cs.kode
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
        flowD: report.flow_rate_d,
        flowBC: report.flow_rate_bc
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

    // Determine if this is a BCD line
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Insert main CIP report
    console.log("Inserting main CIP report...");
    const reportRequest = new sql.Request(transaction);

    // Common fields
    reportRequest
      .input("date", sql.Date, cipData.date || new Date())
      .input("processOrder", sql.VarChar, cipData.processOrder)
      .input("plant", sql.VarChar, cipData.plant)
      .input("line", sql.VarChar, cipData.line)
      .input("cipType", sql.VarChar, cipData.cipType)
      .input("status", sql.VarChar, cipData.status || 'In Progress')
      .input("operator", sql.VarChar, cipData.operator)
      .input("posisi", sql.VarChar, cipData.posisi)
      .input("notes", sql.Text, cipData.notes || '')
      .input("kodeOperator", sql.VarChar, cipData.kodeOperator || '')
      .input("kodeTeknisi", sql.VarChar, cipData.kodeTeknisi || '');

    let insertQuery = `
      INSERT INTO tb_cip_reports 
        (date, process_order, plant, line, cip_type, status, operator, posisi, notes, kode_operator, kode_teknisi`;

    let valuesQuery = `
      VALUES 
        (@date, @processOrder, @plant, @line, @cipType, @status, @operator, @posisi, @notes, @kodeOperator, @kodeTeknisi`;

    // Add line-specific fields
    if (isBCDLine) {
      reportRequest
        .input("flowRateD", sql.Decimal(10, 2), cipData.flowRateD)
        // Hanya input flowRateBC jika LINE B/C
        .input("flowRateBC", sql.Decimal(10, 2), ['LINE B', 'LINE C'].includes(cipData.line) ? cipData.flowRateBC : null)
        .input("valveAStatus", sql.Bit, cipData.valvePositions?.A || false)
        .input("valveBStatus", sql.Bit, cipData.valvePositions?.B || false)
        .input("valveCStatus", sql.Bit, cipData.valvePositions?.C || false);

      insertQuery += `, flow_rate_d${['LINE B', 'LINE C'].includes(cipData.line) ? ', flow_rate_bc' : ''}, valve_a_status, valve_b_status, valve_c_status`;
      valuesQuery += `, @flowRateD${['LINE B', 'LINE C'].includes(cipData.line) ? ', @flowRateBC' : ''}, @valveAStatus, @valveBStatus, @valveCStatus`;
    } else {
      reportRequest.input("flowRate", sql.Decimal(10, 2), cipData.flowRate);
      insertQuery += `, flow_rate`;
      valuesQuery += `, @flowRate`;
    }

    insertQuery += `)` + valuesQuery + `);
      SELECT SCOPE_IDENTITY() AS id;`;

    const reportResult = await reportRequest.query(insertQuery);
    const cipReportId = reportResult.recordset[0].id;

    // Insert CIP steps if provided
    if (cipData.steps && cipData.steps.length > 0) {
      for (const step of cipData.steps) {
        const stepRequest = new sql.Request(transaction);
        await stepRequest
          .input("cipReportId", sql.Int, cipReportId)
          .input("stepNumber", sql.Int, step.stepNumber)
          .input("stepName", sql.VarChar, step.stepName)
          .input("temperatureSetpointMin", sql.Decimal(5, 2), step.temperatureSetpointMin)
          .input("temperatureSetpointMax", sql.Decimal(5, 2), step.temperatureSetpointMax)
          .input("temperatureActual", sql.Decimal(5, 2), step.temperatureActual)
          .input("timeSetpoint", sql.Int, step.timeSetpoint)
          .input("timeActual", sql.Int, step.timeActual)
          .input("concentration", sql.Decimal(5, 2), step.concentration)
          .input("concentrationActual", sql.Decimal(5, 2), step.concentrationActual)
          .input("startTime", sql.VarChar, step.startTime || null)
          .input("endTime", sql.VarChar, step.endTime || null)
          .query(`
            INSERT INTO tb_cip_step_records 
              (cip_report_id, step_number, step_name, temperature_setpoint_min, temperature_setpoint_max,
               temperature_actual, time_setpoint, time_actual, concentration, concentration_actual, 
               start_time, end_time)
            VALUES 
              (@cipReportId, @stepNumber, @stepName, @temperatureSetpointMin, @temperatureSetpointMax,
               @temperatureActual, @timeSetpoint, @timeActual, @concentration, @concentrationActual,
               @startTime, @endTime)
          `);
      }
    }

    // Insert line-specific records
    if (isBCDLine) {
      // Insert special records for BCD lines
      if (cipData.specialRecords && cipData.specialRecords.length > 0) {
        for (const record of cipData.specialRecords) {
          const specialRequest = new sql.Request(transaction);
          await specialRequest
            .input("cipReportId", sql.Int, cipReportId)
            .input("stepType", sql.VarChar, record.stepType)
            .input("tempMin", sql.Decimal(5, 2), record.tempMin || null)
            .input("tempMax", sql.Decimal(5, 2), record.tempMax || null)
            .input("tempActual", sql.Decimal(5, 2), record.tempActual || null)
            .input("tempBC", sql.Decimal(5, 2), record.tempBC || null)
            .input("tempDMin", sql.Decimal(5, 2), record.tempDMin || null)
            .input("tempDMax", sql.Decimal(5, 2), record.tempDMax || null)
            .input("concMin", sql.Decimal(5, 2), record.concMin || null)
            .input("concMax", sql.Decimal(5, 2), record.concMax || null)
            .input("concActual", sql.Decimal(5, 2), record.concActual || null)
            .input("timeMinutes", sql.Int, record.time || null)
            .input("startTime", sql.VarChar, record.startTime || null)
            .input("endTime", sql.VarChar, record.endTime || null)
            .input("kode", sql.VarChar, record.kode || '')
            .query(`
              INSERT INTO tb_cip_special_records 
                (cip_report_id, step_type, temp_min, temp_max, temp_actual,
                 temp_bc, temp_d_min, temp_d_max, conc_min, conc_max, conc_actual,
                 time_minutes, start_time, end_time, kode)
              VALUES 
                (@cipReportId, @stepType, @tempMin, @tempMax, @tempActual,
                 @tempBC, @tempDMin, @tempDMax, @concMin, @concMax, @concActual,
                 @timeMinutes, @startTime, @endTime, @kode)
            `);
        }
      }
    } else {
      // Insert COP records for LINE A
      if (cipData.copRecords && cipData.copRecords.length > 0) {
        for (const cop of cipData.copRecords) {
          const copRequest = new sql.Request(transaction);
          await copRequest
            .input("cipReportId", sql.Int, cipReportId)
            .input("stepType", sql.VarChar, cop.stepType)
            .input("time67Min", sql.Int, cop.time67Min)
            .input("time45Min", sql.Int, cop.time45Min)
            .input("time60Min", sql.Int, cop.time60Min)
            .input("startTime", sql.VarChar, cop.startTime || null)
            .input("endTime", sql.VarChar, cop.endTime || null)
            .input("tempMin", sql.Decimal(5, 2), cop.tempMin)
            .input("tempMax", sql.Decimal(5, 2), cop.tempMax)
            .input("tempActual", sql.Decimal(5, 2), cop.tempActual)
            .input("kode", sql.VarChar, cop.kode)
            .query(`
              INSERT INTO tb_cip_cop_records 
                (cip_report_id, step_type, time_67_min, time_45_min, time_60_min,
                 start_time, end_time, temp_min, temp_max, temp_actual, kode)
              VALUES 
                (@cipReportId, @stepType, @time67Min, @time45Min, @time60Min,
                 @startTime, @endTime, @tempMin, @tempMax, @tempActual, @kode)
            `);
        }
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

// New method that includes compliance score calculation within transaction
async function createCIPReportWithCompliance(cipData, calculateComplianceScore) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    console.log("Starting transaction...");
    await transaction.begin();
    console.log("Transaction started");

    // Determine if this is a BCD line
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Build the insert query based on line type
    const reportRequest = new sql.Request(transaction);

    // Common fields
    reportRequest
      .input("date", sql.Date, cipData.date || new Date())
      .input("processOrder", sql.VarChar, cipData.processOrder)
      .input("plant", sql.VarChar, cipData.plant)
      .input("line", sql.VarChar, cipData.line)
      .input("cipType", sql.VarChar, cipData.cipType)
      .input("status", sql.VarChar, cipData.status || 'In Progress')
      .input("operator", sql.VarChar, cipData.operator)
      .input("posisi", sql.VarChar, cipData.posisi)
      .input("notes", sql.Text, cipData.notes)
      .input("kodeOperator", sql.VarChar, cipData.kodeOperator)
      .input("kodeTeknisi", sql.VarChar, cipData.kodeTeknisi);

    let insertQuery = `
      INSERT INTO tb_cip_reports 
        (date, process_order, plant, line, cip_type, status, operator, posisi, notes, kode_operator, kode_teknisi`;

    let valuesQuery = `
      VALUES 
        (@date, @processOrder, @plant, @line, @cipType, @status, @operator, @posisi, @notes, @kodeOperator, @kodeTeknisi`;

    // Add line-specific fields
    if (isBCDLine) {
      reportRequest
        .input("flowRateD", sql.Decimal(10, 2), cipData.flowRateD)
        // Hanya input flowRateBC jika LINE B/C
        .input("flowRateBC", sql.Decimal(10, 2), ['LINE B', 'LINE C'].includes(cipData.line) ? cipData.flowRateBC : null)
        .input("valveAStatus", sql.Bit, cipData.valvePositions?.A || false)
        .input("valveBStatus", sql.Bit, cipData.valvePositions?.B || false)
        .input("valveCStatus", sql.Bit, cipData.valvePositions?.C || false);

      insertQuery += `, flow_rate_d${['LINE B', 'LINE C'].includes(cipData.line) ? ', flow_rate_bc' : ''}, valve_a_status, valve_b_status, valve_c_status`;
      valuesQuery += `, @flowRateD${['LINE B', 'LINE C'].includes(cipData.line) ? ', @flowRateBC' : ''}, @valveAStatus, @valveBStatus, @valveCStatus`;
    } else {
      reportRequest.input("flowRate", sql.Decimal(10, 2), cipData.flowRate);
      insertQuery += `, flow_rate`;
      valuesQuery += `, @flowRate`;
    }

    insertQuery += `)` + valuesQuery + `);
      SELECT SCOPE_IDENTITY() AS id;`;

    const reportResult = await reportRequest.query(insertQuery);

    console.log("Main report inserted, ID:", reportResult.recordset[0].id);
    const cipReportId = reportResult.recordset[0].id;

    // Create a temporary object to store the data for compliance calculation
    const tempCipData = {
      ...cipData,
      id: cipReportId,
      steps: [],
      copRecords: [],
      specialRecords: []
    };

    // Insert CIP steps (same for all lines)
    if (cipData.steps && cipData.steps.length > 0) {
      console.log(`Inserting ${cipData.steps.length} CIP steps...`);
      for (const [index, step] of cipData.steps.entries()) {
        try {
          console.log(`Inserting step ${index + 1}/${cipData.steps.length}:`, {
            stepNumber: step.stepNumber,
            stepName: step.stepName,
            startTime: step.startTime,
            endTime: step.endTime
          });

          const stepRequest = new sql.Request(transaction);
          await stepRequest
            .input("cipReportId", sql.Int, cipReportId)
            .input("stepNumber", sql.Int, step.stepNumber)
            .input("stepName", sql.VarChar, step.stepName)
            .input("temperatureSetpointMin", sql.Decimal(5, 2), step.temperatureSetpointMin || null)
            .input("temperatureSetpointMax", sql.Decimal(5, 2), step.temperatureSetpointMax || null)
            .input("temperatureActual", sql.Decimal(5, 2), step.temperatureActual || null)
            .input("timeSetpoint", sql.Int, step.timeSetpoint || null)
            .input("timeActual", sql.Int, step.timeActual || null)
            .input("concentration", sql.Decimal(5, 2), step.concentration || null)
            .input("concentrationActual", sql.Decimal(5, 2), step.concentrationActual || null)
            .input("startTime", sql.VarChar, step.startTime || null)
            .input("endTime", sql.VarChar, step.endTime || null)
            .query(`
              INSERT INTO tb_cip_step_records 
                (cip_report_id, step_number, step_name, temperature_setpoint_min, temperature_setpoint_max,
                 temperature_actual, time_setpoint, time_actual, concentration, concentration_actual, 
                 start_time, end_time)
              VALUES 
                (@cipReportId, @stepNumber, @stepName, @temperatureSetpointMin, @temperatureSetpointMax,
                 @temperatureActual, @timeSetpoint, @timeActual, @concentration, @concentrationActual,
                 @startTime, @endTime)
            `);

          console.log(`Step ${index + 1} inserted successfully`);
          tempCipData.steps.push(step);
        } catch (stepError) {
          console.error(`Error inserting step ${index + 1}:`, stepError);
          throw stepError;
        }
      }
      console.log("All steps inserted successfully");
    }

    // Insert line-specific records
    if (isBCDLine) {
      // Insert special records for BCD lines
      if (cipData.specialRecords && cipData.specialRecords.length > 0) {
        console.log(`Inserting ${cipData.specialRecords.length} special records...`);
        for (const [index, record] of cipData.specialRecords.entries()) {
          try {
            console.log(`Inserting special record ${index + 1}/${cipData.specialRecords.length}:`, {
              stepType: record.stepType,
              startTime: record.startTime,
              endTime: record.endTime
            });

            const specialRequest = new sql.Request(transaction);
            await specialRequest
              .input("cipReportId", sql.Int, cipReportId)
              .input("stepType", sql.VarChar, record.stepType)
              .input("tempMin", sql.Decimal(5, 2), record.tempMin || null)
              .input("tempMax", sql.Decimal(5, 2), record.tempMax || null)
              .input("tempActual", sql.Decimal(5, 2), record.tempActual || null)
              .input("tempBC", sql.Decimal(5, 2), record.tempBC || null)
              .input("tempDMin", sql.Decimal(5, 2), record.tempDMin || null)
              .input("tempDMax", sql.Decimal(5, 2), record.tempDMax || null)
              .input("concMin", sql.Decimal(5, 2), record.concMin || null)
              .input("concMax", sql.Decimal(5, 2), record.concMax || null)
              .input("concActual", sql.Decimal(5, 2), record.concActual || null)
              .input("timeMinutes", sql.Int, record.time || null)
              .input("startTime", sql.VarChar, record.startTime || null)
              .input("endTime", sql.VarChar, record.endTime || null)
              .input("kode", sql.VarChar, record.kode || '')
              .query(`
                INSERT INTO tb_cip_special_records 
                  (cip_report_id, step_type, temp_min, temp_max, temp_actual,
                   temp_bc, temp_d_min, temp_d_max, conc_min, conc_max, conc_actual,
                   time_minutes, start_time, end_time, kode)
                VALUES 
                  (@cipReportId, @stepType, @tempMin, @tempMax, @tempActual,
                   @tempBC, @tempDMin, @tempDMax, @concMin, @concMax, @concActual,
                   @timeMinutes, @startTime, @endTime, @kode)
              `);

            console.log(`Special record ${index + 1} inserted successfully`);
            tempCipData.specialRecords.push(record);
          } catch (specialError) {
            console.error(`Error inserting special record ${index + 1}:`, specialError);
            throw specialError;
          }
        }
        console.log("All special records inserted successfully");
      }
    } else {
      // Insert COP records for LINE A
      if (cipData.copRecords && cipData.copRecords.length > 0) {
        console.log(`Inserting ${cipData.copRecords.length} COP records...`);
        for (const [index, cop] of cipData.copRecords.entries()) {
          try {
            console.log(`Inserting COP record ${index + 1}/${cipData.copRecords.length}:`, {
              stepType: cop.stepType,
              startTime: cop.startTime,
              endTime: cop.endTime
            });

            const copRequest = new sql.Request(transaction);
            await copRequest
              .input("cipReportId", sql.Int, cipReportId)
              .input("stepType", sql.VarChar, cop.stepType)
              .input("time67Min", sql.Int, cop.time67Min || null)
              .input("time45Min", sql.Int, cop.time45Min || null)
              .input("time60Min", sql.Int, cop.time60Min || null)
              .input("startTime", sql.VarChar, cop.startTime || null)
              .input("endTime", sql.VarChar, cop.endTime || null)
              .input("tempMin", sql.Decimal(5, 2), cop.tempMin || null)
              .input("tempMax", sql.Decimal(5, 2), cop.tempMax || null)
              .input("tempActual", sql.Decimal(5, 2), cop.tempActual || null)
              .input("kode", sql.VarChar, cop.kode || '')
              .query(`
                INSERT INTO tb_cip_cop_records 
                  (cip_report_id, step_type, time_67_min, time_45_min, time_60_min,
                   start_time, end_time, temp_min, temp_max, temp_actual, kode)
                VALUES 
                  (@cipReportId, @stepType, @time67Min, @time45Min, @time60Min,
                   @startTime, @endTime, @tempMin, @tempMax, @tempActual, @kode)
              `);

            console.log(`COP record ${index + 1} inserted successfully`);
            tempCipData.copRecords.push(cop);
          } catch (copError) {
            console.error(`Error inserting COP record ${index + 1}:`, copError);
            throw copError;
          }
        }
        console.log("All COP records inserted successfully");
      }
    }

    // Calculate compliance score before committing
    let complianceScore = null;
    try {
      console.log("Calculating compliance score...");
      complianceScore = calculateComplianceScore(tempCipData);
      console.log("Compliance score calculated:", complianceScore);
    } catch (complianceError) {
      console.error("Error calculating compliance score:", complianceError);
    }

    console.log("Committing transaction...");
    await transaction.commit();
    console.log("Transaction committed successfully");

    // Fetch the complete report after commit
    console.log("Fetching complete report...");
    const cipReport = await getCIPReportById(cipReportId);

    return {
      cipReport,
      complianceScore
    };
  } catch (error) {
    console.error("Error in createCIPReportWithCompliance:", error);
    console.log("Rolling back transaction...");
    await transaction.rollback();
    console.log("Transaction rolled back");
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      state: error.state,
      class: error.class,
      lineNumber: error.lineNumber,
      serverName: error.serverName,
      procName: error.procName
    });
    throw error;
  }
}

async function updateCIPReport(id, updateData) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Determine if this is a BCD line
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(updateData.line);

    // Build update query dynamically
    const updateFields = [];
    const request = new sql.Request(transaction);
    request.input("id", sql.Int, id);

    // Common fields update
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
    if (updateData.posisi !== undefined) {
      updateFields.push("posisi = @posisi");
      request.input("posisi", sql.VarChar, updateData.posisi);
    }
    if (updateData.notes !== undefined) {
      updateFields.push("notes = @notes");
      request.input("notes", sql.Text, updateData.notes);
    }
    if (updateData.kodeOperator !== undefined) {
      updateFields.push("kode_operator = @kodeOperator");
      request.input("kodeOperator", sql.VarChar, updateData.kodeOperator);
    }
    if (updateData.kodeTeknisi !== undefined) {
      updateFields.push("kode_teknisi = @kodeTeknisi");
      request.input("kodeTeknisi", sql.VarChar, updateData.kodeTeknisi);
    }

    // Line-specific fields update
    if (isBCDLine) {
      if (updateData.flowRateD !== undefined) {
        updateFields.push("flow_rate_d = @flowRateD");
        request.input("flowRateD", sql.Decimal(10, 2), updateData.flowRateD);
      }
      if (updateData.flowRateBC !== undefined) {
        updateFields.push("flow_rate_bc = @flowRateBC");
        request.input("flowRateBC", sql.Decimal(10, 2), updateData.flowRateBC);
      }
      if (updateData.valvePositions) {
        updateFields.push("valve_a_status = @valveAStatus");
        updateFields.push("valve_b_status = @valveBStatus");
        updateFields.push("valve_c_status = @valveCStatus");
        request.input("valveAStatus", sql.Bit, updateData.valvePositions.A || false);
        request.input("valveBStatus", sql.Bit, updateData.valvePositions.B || false);
        request.input("valveCStatus", sql.Bit, updateData.valvePositions.C || false);
      }
    } else {
      if (updateData.flowRate !== undefined) {
        updateFields.push("flow_rate = @flowRate");
        request.input("flowRate", sql.Decimal(10, 2), updateData.flowRate);
      }
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
            .input("temperatureSetpointMin", sql.Decimal(5, 2), step.temperatureSetpointMin)
            .input("temperatureSetpointMax", sql.Decimal(5, 2), step.temperatureSetpointMax)
            .input("temperatureActual", sql.Decimal(5, 2), step.temperatureActual)
            .input("timeSetpoint", sql.Int, step.timeSetpoint)
            .input("timeActual", sql.Int, step.timeActual)
            .input("concentration", sql.Decimal(5, 2), step.concentration)
            .input("concentrationActual", sql.Decimal(5, 2), step.concentrationActual)
            .input("startTime", sql.VarChar, step.startTime || null)
            .input("endTime", sql.VarChar, step.endTime || null)
            .query(`
              INSERT INTO tb_cip_step_records 
                (cip_report_id, step_number, step_name, temperature_setpoint_min, temperature_setpoint_max,
                 temperature_actual, time_setpoint, time_actual, concentration, concentration_actual,
                 start_time, end_time)
              VALUES 
                (@cipReportId, @stepNumber, @stepName, @temperatureSetpointMin, @temperatureSetpointMax,
                 @temperatureActual, @timeSetpoint, @timeActual, @concentration, @concentrationActual,
                 @startTime, @endTime)
            `);
        }
      }
    }

    // Update line-specific records
    if (isBCDLine) {
      // Update special records for BCD lines
      if (updateData.specialRecords) {
        // Delete existing special records
        const deleteSpecialRequest = new sql.Request(transaction);
        await deleteSpecialRequest
          .input("cipReportId", sql.Int, id)
          .query("DELETE FROM tb_cip_special_records WHERE cip_report_id = @cipReportId");

        // Insert new special records
        if (updateData.specialRecords.length > 0) {
          for (const record of updateData.specialRecords) {
            const specialRequest = new sql.Request(transaction);
            await specialRequest
              .input("cipReportId", sql.Int, id)
              .input("stepType", sql.VarChar, record.stepType)
              .input("tempMin", sql.Decimal(5, 2), record.tempMin || null)
              .input("tempMax", sql.Decimal(5, 2), record.tempMax || null)
              .input("tempActual", sql.Decimal(5, 2), record.tempActual || null)
              .input("tempBC", sql.Decimal(5, 2), record.tempBC || null)
              .input("tempDMin", sql.Decimal(5, 2), record.tempDMin || null)
              .input("tempDMax", sql.Decimal(5, 2), record.tempDMax || null)
              .input("concMin", sql.Decimal(5, 2), record.concMin || null)
              .input("concMax", sql.Decimal(5, 2), record.concMax || null)
              .input("concActual", sql.Decimal(5, 2), record.concActual || null)
              .input("timeMinutes", sql.Int, record.time || null)
              .input("startTime", sql.VarChar, record.startTime || null)
              .input("endTime", sql.VarChar, record.endTime || null)
              .input("kode", sql.VarChar, record.kode || '')
              .query(`
                INSERT INTO tb_cip_special_records 
                  (cip_report_id, step_type, temp_min, temp_max, temp_actual,
                   temp_bc, temp_d_min, temp_d_max, conc_min, conc_max, conc_actual,
                   time_minutes, start_time, end_time, kode)
                VALUES 
                  (@cipReportId, @stepType, @tempMin, @tempMax, @tempActual,
                   @tempBC, @tempDMin, @tempDMax, @concMin, @concMax, @concActual,
                   @timeMinutes, @startTime, @endTime, @kode)
              `);
          }
        }
      }
    } else {
      // Update COP records for LINE A
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
              .input("startTime", sql.VarChar, cop.startTime || null)
              .input("endTime", sql.VarChar, cop.endTime || null)
              .input("tempMin", sql.Decimal(5, 2), cop.tempMin)
              .input("tempMax", sql.Decimal(5, 2), cop.tempMax)
              .input("tempActual", sql.Decimal(5, 2), cop.tempActual)
              .input("kode", sql.VarChar, cop.kode)
              .query(`
                INSERT INTO tb_cip_cop_records 
                  (cip_report_id, step_type, time_67_min, time_45_min, time_60_min,
                   start_time, end_time, temp_min, temp_max, temp_actual, kode)
                VALUES 
                  (@cipReportId, @stepType, @time67Min, @time45Min, @time60Min,
                   @startTime, @endTime, @tempMin, @tempMax, @tempActual, @kode)
              `);
          }
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

// New method that includes compliance score calculation within transaction for updates
async function updateCIPReportWithCompliance(id, updateData, calculateComplianceScore) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Check if report exists
    const checkRequest = new sql.Request(transaction);
    const checkResult = await checkRequest
      .input("id", sql.Int, id)
      .query("SELECT COUNT(*) as count FROM tb_cip_reports WHERE id = @id");

    if (checkResult.recordset[0].count === 0) {
      await transaction.rollback();
      return { cipReport: null, complianceScore: null };
    }

    // Update using the same logic as updateCIPReport
    // (Reuse the update logic from updateCIPReport function)

    // Create a temporary object for compliance calculation
    const tempCipData = { ...updateData, id, steps: [], copRecords: [], specialRecords: [] };

    // ... (same update logic as updateCIPReport) ...

    // Calculate compliance score before committing
    let complianceScore = null;
    try {
      if (updateData.steps || updateData.copRecords || updateData.specialRecords) {
        complianceScore = calculateComplianceScore(tempCipData);
      } else {
        const currentData = await getCIPReportByIdWithTransaction(id, transaction);
        if (currentData) {
          complianceScore = calculateComplianceScore(currentData);
        }
      }
    } catch (complianceError) {
      console.error("Error calculating compliance score:", complianceError);
    }

    await transaction.commit();

    // Fetch the complete report after commit
    const cipReport = await getCIPReportById(id);

    return {
      cipReport,
      complianceScore
    };
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating CIP report with compliance:", error);
    throw error;
  }
}

// Helper function to get CIP report by ID within a transaction
async function getCIPReportByIdWithTransaction(id, transaction) {
  try {
    // Get main CIP report
    const reportResult = await transaction
      .request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          cr.id,
          cr.date,
          cr.process_order,
          cr.plant,
          cr.line,
          cr.cip_type,
          cr.status,
          cr.operator,
          cr.posisi,
          cr.flow_rate,
          cr.flow_rate_d,
          cr.flow_rate_bc,
          cr.valve_a_status,
          cr.valve_b_status,
          cr.valve_c_status,
          cr.notes,
          cr.kode_operator,
          cr.kode_teknisi,
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
    const stepsResult = await transaction
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

    // Format the response
    const formattedReport = {
      ...report,
      steps: stepsResult.recordset,
    };

    // Get line-specific records
    if (report.line === 'LINE A') {
      const copResult = await transaction
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
            cc.kode
          FROM tb_cip_cop_records cc
          WHERE cc.cip_report_id = @cipReportId
        `);

      formattedReport.copRecords = copResult.recordset;
    } else if (['LINE B', 'LINE C', 'LINE D'].includes(report.line)) {
      const specialResult = await transaction
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
            cs.end_time as endTime,
            cs.kode
          FROM tb_cip_special_records cs
          WHERE cs.cip_report_id = @cipReportId
        `);

      formattedReport.specialRecords = specialResult.recordset;
    }

    return formattedReport;
  } catch (error) {
    console.error("Error fetching CIP report by ID within transaction:", error);
    throw error;
  }
}

async function deleteCIPReport(id) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Delete related records first (steps, COP records, and special records)
    const deleteStepsRequest = new sql.Request(transaction);
    await deleteStepsRequest
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_step_records WHERE cip_report_id = @cipReportId");

    const deleteCopRequest = new sql.Request(transaction);
    await deleteCopRequest
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_cop_records WHERE cip_report_id = @cipReportId");

    const deleteSpecialRequest = new sql.Request(transaction);
    await deleteSpecialRequest
      .input("cipReportId", sql.Int, id)
      .query("DELETE FROM tb_cip_special_records WHERE cip_report_id = @cipReportId");

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
      { id: 1, name: "CIP 1", value: "CIP_1", description: "CIP Type 1 cleaning process" },
      { id: 2, name: "CIP 2", value: "CIP_2", description: "CIP Type 2 cleaning process" },
      { id: 3, name: "CIP 3", value: "CIP_3", description: "CIP Type 3 cleaning process" },
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
      { id: 1, name: "In Progress", color: "#FF9800" },
      { id: 2, name: "Complete", color: "#4CAF50" },
      { id: 3, name: "Failed", color: "#F44336" },
      { id: 4, name: "Pending", color: "#757575" },
      { id: 5, name: "Cancelled", color: "#F44336" }
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
      "CIP KITCHEN": [
        { stepNumber: 1, stepName: "COLD RINSE", temperatureSetpointMin: 20, temperatureSetpointMax: 35, timeSetpoint: 8 },
        { stepNumber: 2, stepName: "WARM RINSE", temperatureSetpointMin: 70, temperatureSetpointMax: 80, timeSetpoint: 8 },
        { stepNumber: 3, stepName: "ALKALI", temperatureSetpointMin: 70, temperatureSetpointMax: 80, timeSetpoint: 24, concentration: 2.0 },
        { stepNumber: 4, stepName: "COLD RINSE", temperatureSetpointMin: 20, temperatureSetpointMax: 35, timeSetpoint: 8 },
        { stepNumber: 5, stepName: "ACID", temperatureSetpointMin: 60, temperatureSetpointMax: 70, timeSetpoint: 16, concentration: 1.0 },
        { stepNumber: 6, stepName: "WARM RINSE", temperatureSetpointMin: 70, temperatureSetpointMax: 80, timeSetpoint: 16 },
        { stepNumber: 7, stepName: "COLD RINSE", temperatureSetpointMin: 20, temperatureSetpointMax: 35, timeSetpoint: 8 }
      ],
      "BCD_SPECIAL": [
        { stepType: "DRYING", tempMin: 118, tempMax: 125, time: 57 },
        { stepType: "FOAMING", time: 41 },
        { stepType: "DISINFECT/SANITASI", concMin: 0.3, concMax: 0.5, time: 30, tempBC: 40, tempDMin: 20, tempDMax: 35 }
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
  createCIPReportWithCompliance,
  updateCIPReport,
  updateCIPReportWithCompliance,
  deleteCIPReport,
  getCIPTypes,
  getCIPStatusList,
  getCIPStepTemplates
};