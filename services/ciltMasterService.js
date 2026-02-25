const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

function normalizePackageType(value) {
  return String(value || "")
    .toUpperCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isPaperA3Type(value) {
  const normalizedType = normalizePackageType(value);
  return normalizedType === "PAPER A3";
}

function toPaperA3Label(field) {
  const normalized = String(field || "").toLowerCase();

  if (normalized === "jam") return "Jam";
  if (normalized === "roll") return "Roll";
  if (normalized === "paper_order") return "Paper Order";
  if (normalized === "qty_label") return "Qty Label";
  if (normalized === "global_id") return "Global ID";
  if (normalized === "count1_reading") return "Count 1 Reading";
  if (normalized === "kondisi_paper") return "Kondisi";
  if (normalized === "splicing_paper") return "Splicing";
  if (normalized === "mpm_strip_jam") return "Jam";
  if (normalized === "mpm_strip_lot_no") return "Lot No.";
  if (normalized === "mpm_strip_kode") return "Kode";

  return String(field || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function getPaperA3MasterColumns() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'tb_CILT_package_a3_paper'
      ORDER BY ORDINAL_POSITION ASC
    `);

    return (result.recordset || [])
      .map((row, index) => {
        const field = String(row?.COLUMN_NAME || "").trim();
        const normalizedField = field.toLowerCase();

        if (
          !field ||
          normalizedField === "id" ||
          normalizedField === "cilt_id" ||
          normalizedField === "created_by" ||
          normalizedField === "created_at" ||
          normalizedField === "updated_at"
        ) {
          return null;
        }

        return {
          field,
          label: toPaperA3Label(field),
          order_no: Number(row?.ORDINAL_POSITION) || index + 1,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error("Error fetching PAPER A3 master columns:", error);
    logger.error(`Error fetching PAPER A3 master columns: ${error.message}`);
    return [];
  }
}

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
    if (isPaperA3Type(type)) {
      const paperA3Columns = await getPaperA3MasterColumns();
      if (paperA3Columns.length > 0) {
        return paperA3Columns;
      }
    }

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
