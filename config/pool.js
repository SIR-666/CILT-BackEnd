const sql = require("mssql");
const config = require("./db");
const logger = require("./logger");

let pool;

async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log("SQL Server connected (pool created)");
    } catch (err) {
      console.error("Failed to connect to SQL Server:", err);
      logger.error(`Failed to connect to SQL Server: ${err.message}`);
      throw err;
    }
  }
  return pool;
}

module.exports = getPool;
