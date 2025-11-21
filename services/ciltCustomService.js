const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getCustomData() {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM tb_CILT_custom");
    return result.recordset;
  } catch (error) {
    console.error("Error fetching custom data CILT:", error);
  }
}

async function createCustomData(data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("plant", sql.VarChar, data.plant);
    req.input("machine", sql.VarChar, data.machine);
    req.input("line", sql.VarChar, data.line);
    req.input("package", sql.VarChar, data.package);
    req.input("header", sql.VarChar, JSON.stringify(data.header));
    req.input("item", sql.VarChar, JSON.stringify(data.item));
    const customResult = await req.query(`
            INSERT INTO tb_CILT_custom
                (plant, line, machine, package, header, item)
            OUTPUT inserted.*
            VALUES
                (@plant, @line, @machine, @package, @header, @item)
        `);
    await transaction.commit();
    return {
      rowsAffected: customResult.rowsAffected[0],
      inserted: customResult.recordset,
    };
  } catch (error) {
    logger.error("Error creating custom data CILT:", error);
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

async function updateCustomData(id, data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("plant", sql.VarChar, data.plant);
    req.input("machine", sql.VarChar, data.machine);
    req.input("line", sql.VarChar, data.line);
    req.input("package", sql.VarChar, data.package);
    req.input("header", sql.VarChar, JSON.stringify(data.header));
    req.input("item", sql.VarChar, JSON.stringify(data.item));
    const customResult = await req.query(`
            UPDATE tb_CILT_custom
            SET plant = @plant,
                line = @line,
                machine = @machine,
                package = @package,
                header = @header,
                item = @item
            OUTPUT inserted.*
            WHERE id = @id
        `);
    await transaction.commit();
    return {
      rowsAffected: customResult.rowsAffected[0],
      updated: customResult.recordset,
    };
  } catch (error) {
    logger.error("Error updating custom data CILT:", error);
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

async function updatePackageWithRelations(id, data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    // Get old package data first
    const oldDataReq = transaction.request();
    oldDataReq.input("id", sql.Int, id);
    const oldDataResult = await oldDataReq.query(
      "SELECT * FROM tb_CILT_custom WHERE id = @id"
    );
    const oldData = oldDataResult.recordset[0];

    // Update package
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("plant", sql.VarChar, data.plant);
    req.input("machine", sql.VarChar, data.machine);
    req.input("line", sql.VarChar, data.line);
    req.input("package", sql.VarChar, data.package);
    req.input("header", sql.VarChar, data.header);
    req.input("item", sql.VarChar, data.item);
    const customResult = await req.query(`
      UPDATE tb_CILT_custom
      SET plant = @plant, line = @line, machine = @machine,
          package = @package, header = @header, item = @item
      OUTPUT inserted.*
      WHERE id = @id
    `);

    await transaction.commit();
    return {
      rowsAffected: customResult.rowsAffected[0],
      updated: customResult.recordset,
    };
  } catch (error) {
    logger.error("Error updating package with relations:", error);
    if (transaction) await transaction.rollback();
    throw error;
  }
}

async function deleteCustomData(id) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    const deleteResult = await req.query(`
            DELETE FROM tb_CILT_custom
            OUTPUT deleted.*
            WHERE id = @id
        `);
    await transaction.commit();
    return {
      rowsAffected: deleteResult.rowsAffected[0],
      deleted: deleteResult.recordset,
    };
  } catch (error) {
    logger.error("Error deleting custom data CILT:", error);
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
  getCustomData,
  createCustomData,
  updateCustomData,
  deleteCustomData,
  updatePackageWithRelations,
};
