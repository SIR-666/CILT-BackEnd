const sql = require("mssql");
const getPool = require("../config/pool");

/**
 * CIP Template Service
 * Handles fetching CIP master data from database
 */
const cipTemplateService = {
  /* Get CIP Steps (sama untuk semua LINE) */
  async getCipSteps() {
    try {
      const pool = await getPool();
      const result = await pool.request().query(
        `SELECT * FROM cip_steps_master WHERE is_active = 1 ORDER BY display_order`
      );
      
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
      console.error("Error fetching CIP steps:", error);
      return this.getFallbackCipSteps();
    }
  },

  /* Get Special Records based on line type - "LINE A", "LINE B", "LINE C", "LINE D" */
  async getSpecialRecords(lineCode) {
    try {
      const pool = await getPool();
      // Normalize: "LINE A" -> "LINE A", "LINE B/C/D" -> "LINE BCD"
      const lineType = lineCode === "LINE A" ? "LINE A" : "LINE BCD";
      
      const result = await pool.request()
        .input("lineType", sql.VarChar, lineType)
        .query(
          `SELECT * FROM cip_special_records_master WHERE line_type = @lineType AND is_active = 1 ORDER BY display_order`
        );

      if (lineType === "LINE A") {
        // COP, SOP, SIP records
        return result.recordset.map((row) => ({
          stepType: row.step_type,
          time: row.time?.toString() || "",
          tempMin: row.temp_min?.toString() || "105",
          tempMax: row.temp_max?.toString() || "128",
          tempActual: "",
          startTime: "",
          endTime: "",
        }));
      } else {
        // DRYING, FOAMING, DISINFECT records
        return result.recordset.map((row) => ({
          stepType: row.step_type,
          time: row.time?.toString() || "",
          tempMin: row.temp_min?.toString() || null,
          tempMax: row.temp_max?.toString() || null,
          tempBC: row.temp_bc?.toString() || null,
          tempDMin: row.temp_d_min?.toString() || null,
          tempDMax: row.temp_d_max?.toString() || null,
          concMin: row.conc_min?.toString() || null,
          concMax: row.conc_max?.toString() || null,
          tempActual: "",
          concActual: "",
          startTime: "",
          endTime: "",
        }));
      }
    } catch (error) {
      console.error("Error fetching special records:", error);
      return this.getFallbackSpecialRecords(lineCode);
    }
  },

  /* Get Flow Rate configuration by line - "LINE A", "LINE B", "LINE C", "LINE D" */
  async getFlowRate(lineCode) {
    try {
      const pool = await getPool();
      
      const result = await pool.request()
        .input("lineCode", sql.VarChar, lineCode)
        .query(
          `SELECT * FROM cip_flow_rate_master WHERE line_code = @lineCode AND is_active = 1`
        );

      if (result.recordset.length > 0) {
        const row = result.recordset[0];
        return {
          lineCode: row.line_code,
          flowRateMin: row.flow_rate_min,
          flowRateUnit: row.flow_rate_unit || "L/H",
        };
      }
      return this.getFallbackFlowRate(lineCode);
    } catch (error) {
      console.error("Error fetching flow rate:", error);
      return this.getFallbackFlowRate(lineCode);
    }
  },

  /* Get Valve configuration - Final or Intermediate */
  async getValveConfig(posisi) {
    try {
      const pool = await getPool();
      const result = await pool.request().query(
        `SELECT * FROM cip_valve_master WHERE is_active = 1 ORDER BY display_order`
      );

      const valveConfig = {};
      result.recordset.forEach((row) => {
        valveConfig[row.valve_code] = {
          name: row.valve_name,
          state: posisi === "Final" ? row.posisi_final_state : row.posisi_intermediate_state,
        };
      });
      return valveConfig;
    } catch (error) {
      console.error("Error fetching valve config:", error);
      return this.getFallbackValveConfig(posisi);
    }
  },

  /* Get complete template by line - "LINE A", "LINE B", "LINE C", "LINE D" - Final or Intermediate (for LINE B/C/D) */
  async getTemplateByLine(lineCode, posisi = "Final") {
    const [steps, specialRecords, flowRate, valveConfig] = await Promise.all([
      this.getCipSteps(),
      this.getSpecialRecords(lineCode),
      this.getFlowRate(lineCode),
      this.getValveConfig(posisi),
    ]);

    const isLineA = lineCode === "LINE A";

    return {
      lineCode,
      posisi,
      steps,
      specialRecords,
      flowRate,
      valveConfig: isLineA ? null : valveConfig,
    };
  },

  // FALLBACK DATA (jika database tidak tersedia)
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
      // COP, SOP, SIP for LINE A
      return [
        { stepType: "COP", time: "67", tempMin: "105", tempMax: "128", tempActual: "", startTime: "", endTime: "" },
        { stepType: "SOP", time: "45", tempMin: "105", tempMax: "128", tempActual: "", startTime: "", endTime: "" },
        { stepType: "SIP", time: "60", tempMin: "105", tempMax: "128", tempActual: "", startTime: "", endTime: "" },
      ];
    } else {
      // DRYING, FOAMING, DISINFECT for LINE B/C/D
      return [
        { stepType: "DRYING", time: "57", tempMin: "118", tempMax: "125", tempActual: "", startTime: "", endTime: "" },
        { stepType: "FOAMING", time: "41", tempMin: null, tempMax: null, startTime: "", endTime: "" },
        { stepType: "DISINFECT/SANITASI", time: "30", concMin: "0.3", concMax: "0.5", tempBC: "40", tempDMin: "20", tempDMax: "35", concActual: "", tempActual: "", startTime: "", endTime: "" },
      ];
    }
  },

  getFallbackFlowRate(lineCode) {
    const flowRates = {
      "LINE A": { lineCode: "LINE A", flowRateMin: 12000, flowRateUnit: "L/H" },
      "LINE B": { lineCode: "LINE B", flowRateMin: 9000, flowRateUnit: "L/H" },
      "LINE C": { lineCode: "LINE C", flowRateMin: 9000, flowRateUnit: "L/H" },
      "LINE D": { lineCode: "LINE D", flowRateMin: 6000, flowRateUnit: "L/H" },
    };
    return flowRates[lineCode] || { lineCode: lineCode, flowRateMin: 9000, flowRateUnit: "L/H" };
  },

  getFallbackValveConfig(posisi) {
    if (posisi === "Final") {
      return {
        A: { name: "Valve A", state: false }, // Close
        B: { name: "Valve B", state: true },  // Open
        C: { name: "Valve C", state: true },  // Open
      };
    } else {
      return {
        A: { name: "Valve A", state: false }, // Close
        B: { name: "Valve B", state: true },  // Open
        C: { name: "Valve C", state: false }, // Close
      };
    }
  },
};

module.exports = cipTemplateService;