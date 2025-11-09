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

async function createChecklist(data) {
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
    req.input("job_type", sql.VarChar, data.job_type);
    req.input("componen", sql.VarChar, data.componen);
    req.input("standart", sql.VarChar, data.standart);
    req.input("pic", sql.VarChar, data.pic);
    req.input("duration", sql.VarChar, data.duration);
    req.input("maintanance_interval", sql.VarChar, data.maintanance_interval);

    const checklistResult = await req.query(`
      INSERT INTO tb_CILT_checklist_master
        (plant, line, machine, package_type, job_type, componen, standart, pic, duration, maintanance_interval)
      OUTPUT inserted.*
      VALUES
        (@plant, @line, @machine, @package_type, @job_type, @componen, @standart, @pic, @duration, @maintanance_interval)
    `);

    await transaction.commit();

    return {
      rowsAffected: checklistResult.rowsAffected[0],
      inserted: checklistResult.recordset,
    };
  } catch (error) {
    logger.error("Error creating Checklist:", error);
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

async function updateChecklist(id, data) {
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
      job_type: sql.VarChar,
      componen: sql.VarChar,
      standart: sql.VarChar,
      pic: sql.VarChar,
      duration: sql.VarChar,
      maintanance_interval: sql.VarChar,
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
      UPDATE tb_CILT_checklist_master
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
    logger.error("Error updating Checklist:", error);
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

async function disableChecklist(id, visibility) {
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
      UPDATE tb_CILT_checklist_master
      SET visibility = @visibility
      OUTPUT inserted.*
      WHERE id = @id
    `;
    const result = await req.query(disableSql);
    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected[0] || 0,
      updated: result.recordset,
    };
  } catch (error) {
    logger.error("Error disabling Checklist:", error);
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

async function enableChecklist(id, visibility) {
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
      UPDATE tb_CILT_checklist_master
      SET visibility = @visibility
      OUTPUT inserted.*
      WHERE id = @id
    `;
    const result = await req.query(enableSql);
    await transaction.commit();

    return {
      rowsAffected: result.rowsAffected[0] || 0,
      updated: result.recordset,
    };
  } catch (error) {
    logger.error("Error enabling Checklist:", error);
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
  getAllMasterChecklist,
  createChecklist,
  updateChecklist,
  disableChecklist,
  enableChecklist,
};
