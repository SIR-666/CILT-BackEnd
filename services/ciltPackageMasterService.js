const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getPackageMaster(line = null) {
  try {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT id, plant, line, machine, package
      FROM tb_CILT_package_master
    `;

    if (line) {
      query += " WHERE line = @line";
      request.input("line", sql.VarChar, line);
    }

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    logger.error("Error fetching package master CILT:", error);
    throw error;
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
    logger.error("Error fetching package:", error);
    throw error;
  }
}

module.exports = {
  getPackageMaster,
  getPackage,
};
