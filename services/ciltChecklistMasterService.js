const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getAllMasterChecklist(plant, line, machine, type) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .input("machine", sql.VarChar, machine)
      .input("type", sql.VarChar, type)
      .query(
        "SELECT * FROM tb_CILT_checklist_master WHERE plant = @plant AND line = @line AND machine = @machine AND package_type = @type ORDER BY id ASC"
      );

    return result.recordset;
  } catch (error) {
    console.error("Error fetching all master checklist:", error);
  }
}

module.exports = {
  getAllMasterChecklist,
};
