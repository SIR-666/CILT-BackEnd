const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getPackageMaster() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query(
        "SELECT id, plant, line, machine, package FROM tb_CILT_package_master"
      );

    return result.recordset;
  } catch (error) {
    console.error("Error fetching package master CILT:", error);
  }
}

async function getPackage() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT DISTINCT package FROM tb_CILT_package_master");

    return result.recordset;
  } catch (error) {
    console.error("Error fetching package:", error);
  }
}

module.exports = {
  getPackageMaster,
  getPackage,
};
