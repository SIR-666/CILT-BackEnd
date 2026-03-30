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

const A3_FLEX_MASTER_TABLE = "tb_CILT_a3_flex_master";

function isA3FlexType(value) {
  const normalizedType = normalizePackageType(value);
  return normalizedType === "A3 / FLEX";
}

function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error("sort_order must be a valid number");
  }

  return Math.trunc(numericValue);
}

function normalizeBit(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function isA3FlexMasterPayload(data = {}) {
  return (
    isA3FlexType(data?.type ?? data?.package_type) ||
    Object.prototype.hasOwnProperty.call(data, "section_key") ||
    Object.prototype.hasOwnProperty.call(data, "field_key") ||
    Object.prototype.hasOwnProperty.call(data, "data_group")
  );
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

async function getA3FlexMasterRows(plant, line, machine) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("plant", sql.VarChar, plant)
    .input("line", sql.VarChar, line)
    .input("machine", sql.VarChar, machine)
    .input("package_type", sql.VarChar, "A3 / FLEX").query(`
      SELECT
        id,
        plant,
        line,
        machine,
        package_type AS type,
        package_type,
        section_key,
        section_title,
        data_group,
        field_key,
        field_label,
        layout_type,
        input_type,
        placeholder,
        options_json,
        pair_group,
        pair_side,
        sort_order AS order_no,
        sort_order,
        is_readonly,
        is_required,
        is_active,
        created_at,
        updated_at,
        '${A3_FLEX_MASTER_TABLE}' AS source_table
      FROM dbo.${A3_FLEX_MASTER_TABLE}
      WHERE plant = @plant
        AND line = @line
        AND machine = @machine
        AND package_type = @package_type
        AND is_active = 1
      ORDER BY sort_order ASC, id ASC
    `);

  return result.recordset;
}

async function createA3FlexMaster(data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const packageType = data?.package_type || data?.type || "A3 / FLEX";
    const normalizedSortOrder = normalizeSortOrder(data?.sort_order ?? data?.order_no);
    let sortOrder = normalizedSortOrder;

    if (sortOrder === null) {
      const sortOrderResult = await transaction
        .request()
        .input("plant", sql.VarChar, data?.plant)
        .input("line", sql.VarChar, data?.line)
        .input("machine", sql.VarChar, data?.machine)
        .input("package_type", sql.VarChar, packageType).query(`
          SELECT ISNULL(MAX(sort_order), 0) + 1 AS next_sort_order
          FROM dbo.${A3_FLEX_MASTER_TABLE}
          WHERE plant = @plant
            AND line = @line
            AND machine = @machine
            AND package_type = @package_type
        `);

      sortOrder = sortOrderResult.recordset?.[0]?.next_sort_order || 1;
    }

    const result = await transaction
      .request()
      .input("plant", sql.VarChar, data?.plant)
      .input("line", sql.VarChar, data?.line)
      .input("machine", sql.VarChar, data?.machine)
      .input("package_type", sql.VarChar, packageType)
      .input("section_key", sql.VarChar, data?.section_key)
      .input("section_title", sql.NVarChar, data?.section_title)
      .input("data_group", sql.VarChar, data?.data_group)
      .input("field_key", sql.VarChar, data?.field_key)
      .input("field_label", sql.NVarChar, data?.field_label)
      .input("layout_type", sql.VarChar, data?.layout_type)
      .input("input_type", sql.VarChar, data?.input_type)
      .input("placeholder", sql.NVarChar, data?.placeholder ?? null)
      .input("options_json", sql.NVarChar(sql.MAX), data?.options_json ?? null)
      .input("pair_group", sql.Int, data?.pair_group ?? null)
      .input("pair_side", sql.VarChar, data?.pair_side ?? null)
      .input("sort_order", sql.Int, sortOrder)
      .input("is_readonly", sql.Bit, normalizeBit(data?.is_readonly, false))
      .input("is_required", sql.Bit, normalizeBit(data?.is_required, false))
      .input("is_active", sql.Bit, normalizeBit(data?.is_active, true)).query(`
        INSERT INTO dbo.${A3_FLEX_MASTER_TABLE}
          (
            plant,
            line,
            machine,
            package_type,
            section_key,
            section_title,
            data_group,
            field_key,
            field_label,
            layout_type,
            input_type,
            placeholder,
            options_json,
            pair_group,
            pair_side,
            sort_order,
            is_readonly,
            is_required,
            is_active
          )
        OUTPUT inserted.*
        VALUES
          (
            @plant,
            @line,
            @machine,
            @package_type,
            @section_key,
            @section_title,
            @data_group,
            @field_key,
            @field_label,
            @layout_type,
            @input_type,
            @placeholder,
            @options_json,
            @pair_group,
            @pair_side,
            @sort_order,
            @is_readonly,
            @is_required,
            @is_active
          )
      `);

    await transaction.commit();
    return result.recordset?.[0] || null;
  } catch (error) {
    logger.error("Error creating A3 FLEX master:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Rollback failed:", rollbackError);
      }
    }
    throw error;
  }
}

async function updateA3FlexMaster(id, data) {
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
      section_key: sql.VarChar,
      section_title: sql.NVarChar,
      data_group: sql.VarChar,
      field_key: sql.VarChar,
      field_label: sql.NVarChar,
      layout_type: sql.VarChar,
      input_type: sql.VarChar,
      placeholder: sql.NVarChar,
      options_json: sql.NVarChar(sql.MAX),
      pair_group: sql.Int,
      pair_side: sql.VarChar,
      is_readonly: sql.Bit,
      is_required: sql.Bit,
      is_active: sql.Bit,
    };

    const setClauses = [];
    for (const [column, type] of Object.entries(columns)) {
      if (!Object.prototype.hasOwnProperty.call(data, column)) continue;
      let value = data[column];

      if (column === "is_readonly" || column === "is_required" || column === "is_active") {
        value = normalizeBit(value, column === "is_active");
      }

      req.input(column, type, value ?? null);
      setClauses.push(`${column} = @${column}`);
    }

    if (
      Object.prototype.hasOwnProperty.call(data, "sort_order") ||
      Object.prototype.hasOwnProperty.call(data, "order_no")
    ) {
      const sortOrder = normalizeSortOrder(data?.sort_order ?? data?.order_no);
      req.input("sort_order", sql.Int, sortOrder);
      setClauses.push("sort_order = @sort_order");
    }

    if (setClauses.length === 0) {
      throw new Error("No updatable fields provided");
    }

    const result = await req.query(`
      UPDATE dbo.${A3_FLEX_MASTER_TABLE}
      SET ${setClauses.join(", ")},
          updated_at = GETDATE()
      OUTPUT inserted.*
      WHERE id = @id
    `);

    await transaction.commit();
    return {
      rowsAffected: result.rowsAffected?.[0] || 0,
      updated: result.recordset,
    };
  } catch (error) {
    logger.error("Error updating A3 FLEX master:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Rollback failed:", rollbackError);
      }
    }
    throw error;
  }
}

async function deleteA3FlexMaster(id) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const result = await transaction
      .request()
      .input("id", sql.Int, id).query(`
        DELETE FROM dbo.${A3_FLEX_MASTER_TABLE}
        OUTPUT deleted.*
        WHERE id = @id
      `);

    await transaction.commit();
    return {
      rowsAffected: result.rowsAffected?.[0] || 0,
      deleted: result.recordset,
    };
  } catch (error) {
    logger.error("Error deleting A3 FLEX master:", error);
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error("Rollback failed:", rollbackError);
      }
    }
    throw error;
  }
}

async function createMasterCILT(data) {
  try {
    if (isA3FlexMasterPayload(data)) {
      return await createA3FlexMaster(data);
    }

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
    if (isA3FlexType(type)) {
      return await getA3FlexMasterRows(plant, line, machine);
    }

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
    if (isA3FlexMasterPayload(data)) {
      return await updateA3FlexMaster(id, data);
    }

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
    const deletedA3Flex = await deleteA3FlexMaster(id);
    if (deletedA3Flex?.rowsAffected > 0) {
      return deletedA3Flex;
    }

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
