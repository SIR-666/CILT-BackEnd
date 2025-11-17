const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getCustomPlant() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT * FROM tb_CILT_custom_plant");
    return result.recordset;
  } catch (error) {
    console.error("Error fetching custom plant CILT:", error);
  }
}

async function createCustomPlant(data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("plant", sql.VarChar, data.plant);
    const customPlantResult = await req.query(`
            INSERT INTO tb_CILT_custom_plant
                (plant)
            OUTPUT inserted.*
            VALUES
                (@plant)
        `);
    await transaction.commit();
    return {
      rowsAffected: customPlantResult.rowsAffected[0],
      inserted: customPlantResult.recordset,
    };
  } catch (error) {
    logger.error("Error creating custom plant CILT:", error);
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

async function updateCustomPlant(id, data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("plant", sql.VarChar, data.plant);
    const customPlantResult = await req.query(`
            UPDATE tb_CILT_custom_plant
            SET plant = @plant
            OUTPUT inserted.*
            WHERE id = @id
        `);
    await transaction.commit();
    return {
      rowsAffected: customPlantResult.rowsAffected[0],
      updated: customPlantResult.recordset,
    };
  } catch (error) {
    logger.error("Error updating custom plant CILT:", error);
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

async function deleteCustomPlant(id) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    const deleteResult = await req.query(`
            DELETE FROM tb_CILT_custom_plant
            OUTPUT deleted.*
            WHERE id = @id
        `);
    await transaction.commit();
    return {
      rowsAffected: deleteResult.rowsAffected[0],
      deleted: deleteResult.recordset,
    };
  } catch (error) {
    logger.error("Error deleting custom plant CILT:", error);
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
  getCustomPlant,
  createCustomPlant,
  updateCustomPlant,
  deleteCustomPlant,
};
