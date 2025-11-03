const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function createFrom(lineName, lineReference) {
  try {
    const pool = await getPool();
    const transaction = pool.transaction();
    await transaction.begin();
    
    const selectReq = transaction.request();
    selectReq.input("lineRef", sql.NVarChar(200), lineReference);
    const selectResult = await selectReq.query(
      "SELECT plant, machine, package FROM tb_CILT_package_master WHERE line = @lineRef"
    );

    if (!selectResult.recordset.length) {
      await transaction.rollback();
      return 0;
    }

    let inserted = 0;
    for (const row of selectResult.recordset) {
      const insertReq = transaction.request();
      insertReq.input("plant", sql.NVarChar(200), row.plant);
      insertReq.input("line", sql.NVarChar(200), lineName);
      insertReq.input("machine", sql.NVarChar(200), row.machine);
      insertReq.input("package", sql.NVarChar(200), row.package);

      const insertResult = await insertReq.query(
        "INSERT INTO tb_CILT_package_master (plant, line, machine, package) VALUES (@plant, @line, @machine, @package)"
      );

      inserted +=
        (insertResult.rowsAffected && insertResult.rowsAffected[0]) || 0;
    }

    await transaction.commit();
    return inserted;
  } catch (error) {
    logger.error("Error creating package:", error);
    throw error;
  }
}

module.exports = {
  createFrom,
};