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
        `
          SELECT *
          FROM tb_CILT_checklist_master
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
          FROM tb_CILT_checklist_master
          WHERE plant = @plant
            AND line = @line
            AND machine = @machine
            AND package_type = @package_type
        `);

      sortOrder = sortOrderResult.recordset?.[0]?.next_sort_order || 1;
    }

    req.input("sort_order", sql.Int, sortOrder);

    const checklistResult = await req.query(`
      INSERT INTO tb_CILT_checklist_master
        (plant, line, machine, package_type, job_type, componen, standart, pic, duration, maintanance_interval, sort_order)
      OUTPUT inserted.*
      VALUES
        (@plant, @line, @machine, @package_type, @job_type, @componen, @standart, @pic, @duration, @maintanance_interval, @sort_order)
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

async function deleteChecklist(id) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();
    const req = transaction.request();
    req.input("id", sql.Int, id);
    const deleteSql = `
      DELETE FROM tb_CILT_checklist_master
      OUTPUT deleted.*
      WHERE id = @id
    `;
    const result = await req.query(deleteSql);
    await transaction.commit();
    return {
      rowsAffected: result.rowsAffected[0] || 0,
      deleted: result.recordset,
    };
  } catch (error) {
    logger.error("Error deleting Checklist:", error);
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

async function reorderChecklist(items) {
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
        UPDATE tb_CILT_checklist_master
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
    logger.error("Error reordering Checklist:", error);
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
  reorderChecklist,
  disableChecklist,
  enableChecklist,
  deleteChecklist,
};
