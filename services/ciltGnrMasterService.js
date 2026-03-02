const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

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
        `
          SELECT *
          FROM tb_CILT_gnr_master
          WHERE plant = @plant
            AND line = @line
            AND machine = @machine
            AND package_type = @type
          ORDER BY
            CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END ASC,
            sort_order ASC,
            id ASC
        `
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
    const normalizedSortOrder = normalizeSortOrder(data.sort_order);

    let sortOrder = normalizedSortOrder;
    if (sortOrder === null) {
      const sortOrderResult = await transaction
        .request()
        .input("plant", sql.VarChar, data.plant)
        .input("line", sql.VarChar, data.line)
        .input("machine", sql.VarChar, data.machine)
        .input("package_type", sql.VarChar, data.package_type)
        .query(`
          SELECT ISNULL(MAX(sort_order), 0) + 1 AS next_sort_order
          FROM tb_CILT_gnr_master
          WHERE plant = @plant
            AND line = @line
            AND machine = @machine
            AND package_type = @package_type
        `);

      sortOrder = sortOrderResult.recordset?.[0]?.next_sort_order || 1;
    }

    req.input("sort_order", sql.Int, sortOrder);

    const gnrResult = await req.query(`
      INSERT INTO tb_CILT_gnr_master
        (plant, line, machine, package_type, activity, frekuensi, status, good, need, reject, sort_order)
      OUTPUT inserted.*
      VALUES
        (@plant, @line, @machine, @package_type, @activity, @frekuensi, @status, @good, @need, @reject, @sort_order)
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
      sort_order: sql.Int,
    };

    const setClauses = [];
    for (const [col, type] of Object.entries(columns)) {
      if (Object.prototype.hasOwnProperty.call(data, col)) {
        const value =
          col === "sort_order" ? normalizeSortOrder(data[col]) : data[col];
        req.input(col, type, value);
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

async function deleteGNR(id){
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    const deleteSql = `
      DELETE FROM tb_CILT_gnr_master
      OUTPUT deleted.*
      WHERE id = @id
    `;
    const result = await req.query(deleteSql);
    await transaction.commit();
    return {
      rowsAffected: result.rowsAffected?.[0] || 0,
      deleted: result.recordset || [],
    };
} catch (error) {
    logger.error("Error deleting GNR:", error);
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

async function reorderGNR(items) {
  let transaction;
  try {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("items must be a non-empty array");
    }

    const normalizedItems = items.map((item) => {
      if (!item || item.id == null) {
        throw new Error("Each reorder item must include id");
      }

      const sortOrder = normalizeSortOrder(item.sort_order);
      if (sortOrder === null) {
        throw new Error("Each reorder item must include sort_order");
      }

      return {
        id: Number(item.id),
        sort_order: sortOrder,
      };
    });

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const updated = [];
    for (const item of normalizedItems) {
      const req = transaction.request();
      req.input("id", sql.Int, item.id);
      req.input("sort_order", sql.Int, item.sort_order);

      const result = await req.query(`
        UPDATE tb_CILT_gnr_master
        SET sort_order = @sort_order
        OUTPUT inserted.id, inserted.sort_order
        WHERE id = @id
      `);

      if (result.rowsAffected?.[0]) {
        updated.push(...(result.recordset || []));
      }
    }

    await transaction.commit();

    return {
      rowsAffected: updated.length,
      updated,
    };
  } catch (error) {
    logger.error("Error reordering GNR:", error);
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
  reorderGNR,
  disabledGNR,
  enabledGNR,
  deleteGNR,
};
