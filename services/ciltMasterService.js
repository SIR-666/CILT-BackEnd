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

function isH2O2A3Type(value) {
  const normalizedType = normalizePackageType(value);
  return normalizedType === "PEMAKAIAN H2O2 A3";
}

function toTitleLabel(raw) {
  const withTitle = String(raw || "").replace(/\b\w/g, (char) => char.toUpperCase());
  return withTitle
    .replace(/\bId\b/g, "ID")
    .replace(/\bNo\b/g, "No.")
    .replace(/\bQty\b/g, "Qty")
    .replace(/\bMpm\b/g, "MPM");
}

function toPaperA3Label(field) {
  const raw = String(field || "").trim();
  if (!raw) return "";

  const formatted = raw
    .replace(/^mpm_strip_/i, "")
    .replace(/_paper$/i, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/count(\d+)/gi, "count $1")
    .trim();

  return toTitleLabel(formatted);
}

function toPaperA3Section(field, ordinalPosition) {
  const normalizedField = String(field || "").toLowerCase();
  if (normalizedField.startsWith("mpm_strip_")) return "mpm_strip";
  if (normalizedField.endsWith("_paper")) return "paper_sub";

  const position = Number(ordinalPosition);
  if (!Number.isFinite(position)) return "paper_main";
  if (position >= 11) return "mpm_strip";
  if (position >= 9) return "paper_sub";
  return "paper_main";
}

function toPaperA3GroupLabel(section) {
  const normalizedSection = String(section || "").toLowerCase();
  if (normalizedSection === "mpm_strip") return "MPM STRIP";
  if (normalizedSection === "paper_main" || normalizedSection === "paper_sub") {
    return "PAPER";
  }
  return "INSPEKSI";
}

function toPaperA3InputType(field) {
  const normalized = String(field || "").toLowerCase();
  const token = normalized.replace(/[^a-z0-9]/g, "");
  if (normalized.includes("jam")) return "time";
  if (
    token.includes("kondisi") ||
    token.includes("splicing")
  ) {
    return "checkbox";
  }
  if (
    token.includes("kode") ||
    token.includes("label") ||
    token.includes("qtylabel")
  ) {
    return "text";
  }
  return "number";
}

function toH2O2A3Label(field) {
  const raw = String(field || "").trim();
  if (!raw) return "";

  const normalized = raw.toLowerCase();
  if (normalized.includes("persen") && normalized.includes("h2o2")) return "%";

  const plain = raw.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return plain.replace(/\b\w/g, (char) => char.toUpperCase());
}

function toInputTypeByDataType(dataType) {
  const normalized = String(dataType || "").toLowerCase();
  if (normalized === "time") return "time";
  if (
    normalized === "int" ||
    normalized === "bigint" ||
    normalized === "smallint" ||
    normalized === "tinyint" ||
    normalized === "decimal" ||
    normalized === "numeric" ||
    normalized === "float" ||
    normalized === "real"
  ) {
    return "number";
  }
  return "text";
}

function toH2O2A3Unit(field) {
  const normalized = String(field || "").toLowerCase();
  if (normalized.includes("jam")) return "WIB";
  if (normalized.includes("liter")) return "LTR";
  if (normalized.includes("persen")) return "%";
  return "";
}

function toH2O2Section(tableName, field) {
  const normalizedTable = String(tableName || "").toLowerCase();
  if (normalizedTable.includes("penambahan")) return "penambahan";
  if (normalizedTable.includes("mccp")) return "mccp";

  const normalizedField = String(field || "").toLowerCase();
  if (normalizedField.includes("kondisi")) return "check";
  return "persiapan";
}

async function getH2O2ColumnsByTable(pool, tableName, orderOffset = 0) {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${tableName}'
    ORDER BY ORDINAL_POSITION ASC
  `);

  return (result.recordset || [])
    .map((row, index) => {
      const field = String(row?.COLUMN_NAME || "").trim();
      const normalizedField = field.toLowerCase();
      const ignore =
        normalizedField === "id" ||
        normalizedField === "cilt_id" ||
        normalizedField === "h2o2_master_id" ||
        normalizedField === "created_by" ||
        normalizedField === "created_at" ||
        normalizedField === "updated_at";

      if (!field || ignore) {
        return null;
      }

      return {
        field,
        label: toH2O2A3Label(field),
        order_no: orderOffset + (Number(row?.ORDINAL_POSITION) || index + 1),
        section: toH2O2Section(tableName, field),
        source_table: tableName,
        input_type: toInputTypeByDataType(row?.DATA_TYPE),
        unit: toH2O2A3Unit(field),
      };
    })
    .filter(Boolean);
}

async function getH2O2A3MasterColumns() {
  try {
    const pool = await getPool();
    const masterColumns = await getH2O2ColumnsByTable(pool, "tb_CILT_h2o2_a3_master", 0);
    const penambahanColumns = await getH2O2ColumnsByTable(
      pool,
      "tb_CILT_h2o2_a3_penambahan",
      100
    );
    const mccpColumns = await getH2O2ColumnsByTable(pool, "tb_CILT_h2o2_a3_mccp", 200);

    const sectionRank = {
      persiapan: 1,
      penambahan: 2,
      mccp: 3,
      check: 4,
    };

    return [...masterColumns, ...penambahanColumns, ...mccpColumns].sort((a, b) => {
      const leftRank = sectionRank[a.section] || 99;
      const rightRank = sectionRank[b.section] || 99;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return (a.order_no || 0) - (b.order_no || 0);
    });
  } catch (error) {
    console.error("Error fetching H2O2 A3 master columns:", error);
    logger.error(`Error fetching H2O2 A3 master columns: ${error.message}`);
    return [];
  }
}

async function getPaperA3MasterColumns() {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE
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

        const section = toPaperA3Section(field, row?.ORDINAL_POSITION);

        return {
          field,
          label: toPaperA3Label(field),
          order_no: Number(row?.ORDINAL_POSITION) || index + 1,
          section,
          group_label: toPaperA3GroupLabel(section),
          input_type: toPaperA3InputType(field),
          source_table: "tb_CILT_package_a3_paper",
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

    if (isH2O2A3Type(type)) {
      const h2o2A3Columns = await getH2O2A3MasterColumns();
      if (h2o2A3Columns.length > 0) {
        return h2o2A3Columns;
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
