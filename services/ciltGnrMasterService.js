const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getAllMasterGNR(plant, line, machine, type) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .input("machine", sql.VarChar, machine)
      .input("type", sql.VarChar, type)
      .query(
        "SELECT * FROM tb_CILT_gnr_master WHERE plant = @plant AND line = @line AND machine = @machine AND package_type = @type ORDER BY id ASC"
      );

    return result.recordset;
  } catch (error) {
    console.error("Error fetching all master GNR:", error);
  }
}

async function createGNR(data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();

    req.input("plant", sql.VarChar, data.plant);
    req.input("line", sql.VarChar, data.line);
    req.input("machine", sql.VarChar, data.machine);
    req.input("package_type", sql.VarChar, data.package_type);
    req.input("activity", sql.VarChar, data.activity);
    req.input("frekuensi", sql.VarChar, data.frekuensi);
    req.input("status", sql.TinyInt, data.status);
    req.input("good", sql.VarChar, data.good);
    req.input("need", sql.VarChar, data.need);
    req.input("reject", sql.VarChar, data.reject);

    const gnrResult = await req.query(`
      INSERT INTO tb_CILT_gnr_master
        (plant, line, machine, package_type, activity, frekuensi, status, good, need, reject)
      OUTPUT inserted.*
      VALUES
        (@plant, @line, @machine, @package_type, @activity, @frekuensi, @status, @good, @need, @reject)
    `);

    await transaction.commit();

    return {
      rowsAffected: gnrResult.rowsAffected[0],
      inserted: gnrResult.recordset,
    };
  } catch (error) {
    logger.error("Error creating GNR:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        logger.error("Rollback failed:", rbErr);
      }
    }
    throw error;
  }
}

async function updateGNR(id, data) {
  if (id == null) throw new Error("Missing id for update");
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();

    req.input("id", sql.Int, id);

    const columns = {
      plant: sql.VarChar,
      line: sql.VarChar,
      machine: sql.VarChar,
      package_type: sql.VarChar,
      activity: sql.VarChar,
      frekuensi: sql.VarChar,
      status: sql.TinyInt,
      good: sql.VarChar,
      need: sql.VarChar,
      reject: sql.VarChar,
    };

    const setClauses = [];
    for (const [col, type] of Object.entries(columns)) {
      if (Object.prototype.hasOwnProperty.call(data, col)) {
        req.input(col, type, data[col]);
        setClauses.push(`${col} = @${col}`);
      }
    }

    if (setClauses.length === 0) {
      throw new Error("No updatable fields provided");
    }

    const updateSql = `
      UPDATE tb_CILT_gnr_master
      SET ${setClauses.join(", ")}
      OUTPUT inserted.*
      WHERE id = @id
    `;

    const result = await req.query(updateSql);
    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected[0] || 0,
      updated: result.recordset,
    };
  } catch (error) {
    logger.error("Error updating GNR:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        logger.error("Rollback failed:", rbErr);
      }
    }
    throw error;
  }
}

async function disabledGNR(id, visibility = 0) {
  if (id == null) throw new Error("Missing id for disable");
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("visibility", sql.Bit, visibility);

    const disableSql = `
      UPDATE tb_CILT_gnr_master
      SET visibility = @visibility
      OUTPUT inserted.*
      WHERE id = @id
    `;

    const result = await req.query(disableSql);
    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected?.[0] || 0,
      updated: result.recordset || [],
    };
  } catch (error) {
    logger.error("Error disabling GNR:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        logger.error("Rollback failed:", rbErr);
      }
    }
    throw error;
  }
}

async function enabledGNR(id, visibility = 1) {
  if (id == null) throw new Error("Missing id for enable");
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("visibility", sql.Bit, visibility);

    const enableSql = `
      UPDATE tb_CILT_gnr_master
      SET visibility = @visibility
      OUTPUT inserted.*
      WHERE id = @id
    `;

    const result = await req.query(enableSql);
    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected?.[0] || 0,
      updated: result.recordset || [],
    };
  } catch (error) {
    logger.error("Error enabling GNR:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rbErr) {
        logger.error("Rollback failed:", rbErr);
      }
    }
    throw error;
  }
}

module.exports = {
  getAllMasterGNR,
  createGNR,
  updateGNR,
  disabledGNR,
  enabledGNR,
};
