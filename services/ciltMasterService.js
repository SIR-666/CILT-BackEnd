const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function createMasterCILT(data) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("cilt", sql.VarChar, data.cilt)
      .input("type", sql.VarChar, data.type)
      .input("ci", sql.VarChar, data.ci)
      .input("activity", sql.VarChar, data.activity)
      .input("min", sql.VarChar, data.min)
      .input("max", sql.VarChar, data.max)
      .input("frekwensi", sql.VarChar, data.frekwensi)
      .input("content", sql.VarChar, data.content)
      .input("image", sql.VarChar, data.image)
      .input("plant", sql.NVarChar, data.plant)
      .input("line", sql.NVarChar, data.line)
      .input("status", sql.VarChar, data.status).query(`
        INSERT INTO tb_CILT_master (cilt, type, ci, activity, min, max, frekwensi, content, image, plant, line, status)
        OUTPUT inserted.id
        VALUES (@cilt, @type, @ci, @activity, @min, @max, @frekwensi, @content, @image, @plant, @line, @status)
      `);

    return result.recordset[0].id;
  } catch (error) {
    console.error("Error creating master CILT:", error);
  }
}

async function getMasterCILT(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM tb_CILT_master WHERE id = @id");

    return result.recordset;
  } catch (error) {
    console.error("Error fetching master CILT:", error);
  }
}

async function getAllMasterCILT(plant, line, machine, type) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .input("machine", sql.VarChar, machine)
      .input("type", sql.VarChar, type)
      .query(
        "SELECT * FROM tb_CILT_master WHERE plant = @plant AND line = @line AND cilt = @machine AND type = @type ORDER BY id DESC"
      );

    return result.recordset;
  } catch (error) {
    console.error("Error fetching all master CILT:", error);
  }
}

async function getPlant() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT DISTINCT plant FROM tb_CILT_master");

    return result.recordset;
  } catch (error) {
    console.error("Error fetching plant:", error);
  }
}

async function getLine(plant) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .query("SELECT DISTINCT line FROM tb_CILT_master WHERE plant = @plant");

    return result.recordset;
  } catch (error) {
    console.error("Error fetching line:", error);
  }
}

async function getMachine(plant, line) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .query(
        "SELECT DISTINCT cilt AS machine FROM tb_CILT_master WHERE plant = @plant AND line = @line"
      );

    return result.recordset;
  } catch (error) {
    console.error("Error fetching machine:", error);
  }
}

async function getType(plant, line, machine) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .input("machine", sql.VarChar, machine)
      .query(
        "SELECT DISTINCT type FROM tb_CILT_master WHERE plant = @plant AND line = @line AND cilt = @machine"
      );

    return result.recordset;
  } catch (error) {
    console.error("Error fetching type:", error);
  }
}

async function updateMasterCILT(id, data) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("cilt", sql.VarChar, data.cilt)
      .input("type", sql.VarChar, data.type)
      .input("ci", sql.VarChar, data.ci)
      .input("activity", sql.VarChar, data.activity)
      .input("min", sql.VarChar, data.min)
      .input("max", sql.VarChar, data.max)
      .input("frekwensi", sql.VarChar, data.frekwensi)
      .input("content", sql.VarChar, data.content)
      .input("image", sql.VarChar, data.image)
      .input("plant", sql.NVarChar, data.plant)
      .input("line", sql.NVarChar, data.line)
      .input("status", sql.VarChar, data.status).query(`
        UPDATE tb_CILT_master
        SET cilt = @cilt, type = @type, ci = @ci, activity = @activity, min = @min, max = @max, frekwensi = @frekwensi,
            content = @content, image = @image, plant = @plant, line = @line, status = @status,
            updatedAt = GETDATE()
        WHERE id = @id
      `);

    return result.rowsAffected;
  } catch (error) {
    console.error("Error updating master CILT:", error);
  }
}

async function deleteMasterCILT(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM tb_CILT_master WHERE id = @id");

    return result.rowsAffected;
  } catch (error) {
    console.error("Error deleting master CILT:", error);
  }
}

module.exports = {
  createMasterCILT,
  getMasterCILT,
  getAllMasterCILT,
  getPlant,
  getLine,
  getMachine,
  getType,
  updateMasterCILT,
  deleteMasterCILT,
};
