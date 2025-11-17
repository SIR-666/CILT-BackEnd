const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getCustomMachine() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT * FROM tb_CILT_custom_machine");
    return result.recordset;
  } catch (error) {
    console.error("Error fetching custom machine CILT:", error);
  }
}

async function createCustomMachine(data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("machine", sql.VarChar, data.machine);
    const customMachineResult = await req.query(`
                INSERT INTO tb_CILT_custom_machine
                    (machine)
                OUTPUT inserted.*
                VALUES
                    (@machine)
            `);
    await transaction.commit();
    return {
      rowsAffected: customMachineResult.rowsAffected[0],
      inserted: customMachineResult.recordset,
    };
  } catch (error) {
    logger.error("Error creating custom machine CILT:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Error rolling back transaction:", rollbackError);
      }
    }
    throw error;
  }
}

async function updateCustomMachine(id, data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("machine", sql.VarChar, data.machine);
    const customMachineResult = await req.query(`
                UPDATE tb_CILT_custom_machine
                SET machine = @machine
                OUTPUT inserted.*
                WHERE id = @id
            `);
    await transaction.commit();
    return {
      rowsAffected: customMachineResult.rowsAffected[0],
      updated: customMachineResult.recordset,
    };
  } catch (error) {
    logger.error("Error updating custom machine CILT:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Error rolling back transaction:", rollbackError);
      }
    }
    throw error;
  }
}

async function deleteCustomMachine(id) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    const customMachineResult = await req.query(`
                DELETE FROM tb_CILT_custom_machine
                OUTPUT deleted.*
                WHERE id = @id
            `);
    await transaction.commit();
    return {
      rowsAffected: customMachineResult.rowsAffected[0],
      deleted: customMachineResult.recordset,
    };
  } catch (error) {
    logger.error("Error deleting custom machine CILT:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Error rolling back transaction:", rollbackError);
      }
    }
    throw error;
  }
}

module.exports = {
  getCustomMachine,
  createCustomMachine,
  updateCustomMachine,
  deleteCustomMachine,
};
