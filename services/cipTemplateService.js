const sql = require("mssql");
const getPool = require("../config/pool");

/**
 * CIP Template Service
 * Fetches template data from MASTER tables (uppercase CIP):
 * - tb_CIP_steps_master
 * - tb_CIP_special_records_master
 * - tb_CIP_flow_rate_master
 * - tb_CIP_valve_master
 */

const cipTemplateService = {
  
  /**
   * Get CIP Steps from master table (same for all lines)
   */
  async getCipSteps() {
    try {
      const pool = await getPool();
      const result = await pool.request().query(
        `SELECT * FROM tb_CIP_steps_master WHERE is_active = 1 ORDER BY display_order`
      );
      
      if (result.recordset.length === 0) {
        console.log("[getCipSteps] No data in master table, using fallback");
        return this.getFallbackCipSteps();
      }

      return result.recordset.map((row) => ({
        stepNumber: row.step_number,
        stepName: row.step_name,
        temperatureSetpointMin: row.temperature_setpoint_min?.toString() || "",
        temperatureSetpointMax: row.temperature_setpoint_max?.toString() || "",
        timeSetpoint: row.time_setpoint?.toString() || "",
        concentrationMin: row.concentration_min?.toString() || null,
        concentrationMax: row.concentration_max?.toString() || null,
        // Fields to be filled by user
        temperatureActual: "",
        timeActual: row.time_setpoint?.toString() || "",
        concentrationActual: "",
        startTime: "",
        endTime: "",
      }));
    } catch (error) {
      console.error("[getCipSteps] Error:", error.message);
      return this.getFallbackCipSteps();
    }
  },

  /* Get Special Records from master table - "LINE A", "LINE B", "LINE C", or "LINE D" */
  async getSpecialRecords(lineCode) {
    try {
      const pool = await getPool();
      // LINE A uses "LINE A", LINE B/C/D uses "LINE BCD"
      const lineType = lineCode === "LINE A" ? "LINE A" : "LINE BCD";
      
      const result = await pool.request()
        .input("lineType", sql.VarChar, lineType)
        .query(
          `SELECT * FROM tb_CIP_special_records_master 
           WHERE line_type = @lineType AND is_active = 1 
           ORDER BY display_order`
        );

      if (result.recordset.length === 0) {
        console.log("[getSpecialRecords] No data for", lineType, ", using fallback");
        return this.getFallbackSpecialRecords(lineCode);
      }

      if (lineType === "LINE A") {
        // COP, SOP, SIP records
        return result.recordset.map((row) => ({
          stepType: row.step_type,
          time: row.time_setpoint?.toString() || "",
          tempMin: row.temp_min?.toString() || "105",
          tempMax: row.temp_max?.toString() || "128",
          hasTemperature: row.has_temperature === 1 || row.has_temperature === true,
          hasConcentration: row.has_concentration === 1 || row.has_concentration === true,
          // Fields to be filled by user
          tempActual: "",
          startTime: "",
          endTime: "",
        }));
      } else {
        // DRYING, FOAMING, DISINFECT records for LINE B/C/D
        return result.recordset.map((row) => ({
          stepType: row.step_type,
          time: row.time_setpoint?.toString() || "",
          tempMin: row.temp_min?.toString() || null,
          tempMax: row.temp_max?.toString() || null,
          tempBC: row.temp_bc?.toString() || null,
          tempDMin: row.temp_d_min?.toString() || null,
          tempDMax: row.temp_d_max?.toString() || null,
          concMin: row.conc_min?.toString() || null,
          concMax: row.conc_max?.toString() || null,
          hasTemperature: row.has_temperature === 1 || row.has_temperature === true,
          hasConcentration: row.has_concentration === 1 || row.has_concentration === true,
          // Fields to be filled by user
          tempActual: "",
          concActual: "",
          startTime: "",
          endTime: "",
        }));
      }
    } catch (error) {
      console.error("[getSpecialRecords] Error:", error.message);
      return this.getFallbackSpecialRecords(lineCode);
    }
  },

  /* Get Flow Rate configuration from master table - "LINE A", "LINE B", "LINE C", or "LINE D" */
  async getFlowRate(lineCode) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input("lineCode", sql.VarChar, lineCode)
        .query(
          `SELECT * FROM tb_CIP_flow_rate_master 
           WHERE line_code = @lineCode AND is_active = 1`
        );

      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        return {
          lineCode: row.line_code,
          flowRateMin: row.flow_rate_min,
          flowRateUnit: row.flow_rate_unit || "L/H",
          flowRateActual: "", // User fills this
        };
      }
      
      console.log("[getFlowRate] No data for", lineCode, ", using fallback");
      return this.getFallbackFlowRate(lineCode);
    } catch (error) {
      console.error("[getFlowRate] Error:", error.message);
      return this.getFallbackFlowRate(lineCode);
    }
  },

  /* Get Valve configuration from master table - "Final" or "Intermediate" */
  async getValveConfig(posisi) {
    try {
      const pool = await getPool();
      const result = await pool.request().query(
        `SELECT * FROM tb_CIP_valve_master WHERE is_active = 1 ORDER BY display_order`
      );

      if (result.recordset.length === 0) {
        console.log("[getValveConfig] No data in master table, using fallback");
        return this.getFallbackValveConfig(posisi);
      }

      // Transform to array format for frontend
      return result.recordset.map((row) => {
        const state = posisi === "Final" 
          ? row.posisi_final_state 
          : row.posisi_intermediate_state;
        
        const isChecked = state === 1 || state === true;
        
        return {
          valveCode: row.valve_code,
          checked: isChecked,
          label: `${row.valve_name} (${isChecked ? "Open" : "Close"})`,
        };
      });
    } catch (error) {
      console.error("[getValveConfig] Error:", error.message);
      return this.getFallbackValveConfig(posisi);
    }
  },

  /* Get complete template by line - "LINE A", "LINE B", "LINE C", or "LINE D" - "Final" or "Intermediate" (for valve config) */
  async getTemplateByLine(lineCode, posisi = "Final") {
    const [cipSteps, specialRecords, flowRate, valveConfig] = await Promise.all([
      this.getCipSteps(),
      this.getSpecialRecords(lineCode),
      this.getFlowRate(lineCode),
      this.getValveConfig(posisi),
    ]);

    const isLineA = lineCode === "LINE A";

    return {
      lineCode,
      posisi,
      cipSteps,
      specialRecords,
      flowRate,
      valveConfig: isLineA ? [] : valveConfig, // No valves for LINE A
    };
  },

  // FALLBACK DATA (if database is unavailable)
  getFallbackCipSteps() {
    return [
      { stepNumber: 1, stepName: "COLD RINSE", temperatureSetpointMin: "20", temperatureSetpointMax: "35", timeSetpoint: "8", concentrationMin: null, concentrationMax: null, temperatureActual: "", timeActual: "8", concentrationActual: "", startTime: "", endTime: "" },
      { stepNumber: 2, stepName: "WARM RINSE", temperatureSetpointMin: "70", temperatureSetpointMax: "80", timeSetpoint: "8", concentrationMin: null, concentrationMax: null, temperatureActual: "", timeActual: "8", concentrationActual: "", startTime: "", endTime: "" },
      { stepNumber: 3, stepName: "ALKALI", temperatureSetpointMin: "70", temperatureSetpointMax: "80", timeSetpoint: "24", concentrationMin: "1.5", concentrationMax: "2.0", temperatureActual: "", timeActual: "24", concentrationActual: "", startTime: "", endTime: "" },
      { stepNumber: 4, stepName: "COLD RINSE", temperatureSetpointMin: "20", temperatureSetpointMax: "35", timeSetpoint: "8", concentrationMin: null, concentrationMax: null, temperatureActual: "", timeActual: "8", concentrationActual: "", startTime: "", endTime: "" },
      { stepNumber: 5, stepName: "ACID", temperatureSetpointMin: "60", temperatureSetpointMax: "70", timeSetpoint: "16", concentrationMin: "0.5", concentrationMax: "1.0", temperatureActual: "", timeActual: "16", concentrationActual: "", startTime: "", endTime: "" },
      { stepNumber: 6, stepName: "WARM RINSE", temperatureSetpointMin: "70", temperatureSetpointMax: "80", timeSetpoint: "16", concentrationMin: null, concentrationMax: null, temperatureActual: "", timeActual: "16", concentrationActual: "", startTime: "", endTime: "" },
      { stepNumber: 7, stepName: "COLD RINSE", temperatureSetpointMin: "20", temperatureSetpointMax: "35", timeSetpoint: "8", concentrationMin: null, concentrationMax: null, temperatureActual: "", timeActual: "8", concentrationActual: "", startTime: "", endTime: "" },
    ];
  },

  getFallbackSpecialRecords(lineCode) {
    const isLineA = lineCode === "LINE A";
    
    if (isLineA) {
      return [
        { stepType: "COP", time: "67", tempMin: "105", tempMax: "128", hasTemperature: true, hasConcentration: false, tempActual: "", startTime: "", endTime: "" },
        { stepType: "SOP", time: "45", tempMin: "105", tempMax: "128", hasTemperature: true, hasConcentration: false, tempActual: "", startTime: "", endTime: "" },
        { stepType: "SIP", time: "60", tempMin: "105", tempMax: "128", hasTemperature: true, hasConcentration: false, tempActual: "", startTime: "", endTime: "" },
      ];
    } else {
      return [
        { stepType: "DRYING", time: "57", tempMin: "118", tempMax: "125", hasTemperature: true, hasConcentration: false, tempActual: "", startTime: "", endTime: "" },
        { stepType: "FOAMING", time: "41", hasTemperature: false, hasConcentration: false, startTime: "", endTime: "" },
        { stepType: "DISINFECT/SANITASI", time: "30", tempBC: "40", tempDMin: "20", tempDMax: "35", concMin: "0.3", concMax: "0.5", hasTemperature: true, hasConcentration: true, tempActual: "", concActual: "", startTime: "", endTime: "" },
      ];
    }
  },

  getFallbackFlowRate(lineCode) {
    const flowRates = {
      "LINE A": { lineCode: "LINE A", flowRateMin: 12000, flowRateUnit: "L/H", flowRateActual: "" },
      "LINE B": { lineCode: "LINE B", flowRateMin: 9000, flowRateUnit: "L/H", flowRateActual: "" },
      "LINE C": { lineCode: "LINE C", flowRateMin: 9000, flowRateUnit: "L/H", flowRateActual: "" },
      "LINE D": { lineCode: "LINE D", flowRateMin: 6000, flowRateUnit: "L/H", flowRateActual: "" },
    };
    return flowRates[lineCode] || { lineCode, flowRateMin: 9000, flowRateUnit: "L/H", flowRateActual: "" };
  },

  getFallbackValveConfig(posisi) {
    if (posisi === "Final") {
      return [
        { valveCode: "A", checked: false, label: "Valve A (Close)" },
        { valveCode: "B", checked: true, label: "Valve B (Open)" },
        { valveCode: "C", checked: true, label: "Valve C (Open)" },
      ];
    } else {
      return [
        { valveCode: "A", checked: false, label: "Valve A (Close)" },
        { valveCode: "B", checked: true, label: "Valve B (Open)" },
        { valveCode: "C", checked: false, label: "Valve C (Close)" },
      ];
    }
  },
};

module.exports = cipTemplateService;