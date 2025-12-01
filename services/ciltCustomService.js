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
    const headerStr = typeof data.header === 'string'
      ? data.header
      : JSON.stringify(data.header || {});
    const itemStr = typeof data.item === 'string'
      ? data.item
      : JSON.stringify(data.item || []);

    req.input("header", sql.NVarChar(sql.MAX), headerStr);
    req.input("item", sql.NVarChar(sql.MAX), itemStr);
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

    const {
      plant,
      machine,
      line,
      package: packageName,
      header,
      item
    } = data;

    const headerStr = typeof header === 'string'
      ? header
      : JSON.stringify(header || {});
    const itemStr = typeof item === 'string'
      ? item
      : JSON.stringify(item || []);

    // 1. Update metadata
    const metaReq = transaction.request();
    metaReq.input("id", sql.Int, id);
    metaReq.input("plant", sql.VarChar, plant);
    metaReq.input("machine", sql.VarChar, machine);
    metaReq.input("line", sql.VarChar, line);
    metaReq.input("package", sql.VarChar, packageName);
    metaReq.input("header", sql.NVarChar(sql.MAX), headerStr);
    metaReq.input("item", sql.NVarChar(sql.MAX), itemStr);

    const customResult = await metaReq.query(`
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

    // 2. Update designer (kalau ada) supaya sync
    const designerReq = transaction.request();
    designerReq.input("id", sql.Int, id);
    designerReq.input("plant", sql.VarChar, plant);
    designerReq.input("machine", sql.VarChar, machine);
    designerReq.input("line", sql.VarChar, line);
    designerReq.input("package", sql.VarChar, packageName);
    designerReq.input("header", sql.NVarChar(sql.MAX), headerStr);
    designerReq.input("item", sql.NVarChar(sql.MAX), itemStr);

    await designerReq.query(`
      UPDATE tb_CILT_custom_packages
      SET plant = @plant,
          line = @line,
          machine = @machine,
          package = @package,
          header = @header,
          item = @item,
          updated_at = GETDATE()
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

    const oldDataReq = transaction.request();
    oldDataReq.input("id", sql.Int, id);
    const oldDataResult = await oldDataReq.query(
      "SELECT * FROM tb_CILT_custom WHERE id = @id"
    );
    const oldData = oldDataResult.recordset[0];

    if (!oldData) {
      throw new Error(`Package with ID ${id} not found`);
    }

    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("plant", sql.VarChar, data.plant);
    req.input("machine", sql.VarChar, data.machine);
    req.input("line", sql.VarChar, data.line);
    req.input("package", sql.VarChar, data.package);
    const headerStr = typeof data.header === 'string'
      ? data.header
      : JSON.stringify(data.header || {});
    const itemStr = typeof data.item === 'string'
      ? data.item
      : JSON.stringify(data.item || []);

    req.input("header", sql.NVarChar(sql.MAX), headerStr);
    req.input("item", sql.NVarChar(sql.MAX), itemStr);
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
    const selectResult = await req.query(`
      SELECT * FROM tb_CILT_custom WHERE id = @id
    `);

    if (selectResult.recordset.length === 0) {
      throw new Error(`Package with ID ${id} not found`);
    }
    const packageInfo = selectResult.recordset[0];
    const deleteResult = await req.query(`
      DELETE FROM tb_CILT_custom
      OUTPUT deleted.*
      WHERE id = @id
    `);

    const req2 = transaction.request();
    req2.input("plant", sql.VarChar, packageInfo.plant);
    req2.input("machine", sql.VarChar, packageInfo.machine);
    req2.input("line", sql.VarChar, packageInfo.line);
    req2.input("package", sql.VarChar, packageInfo.package);

    const deletePackageResult = await req2.query(`
      DELETE FROM tb_CILT_custom_packages
      OUTPUT deleted.*
      WHERE plant = @plant 
        AND machine = @machine 
        AND line = @line 
        AND package = @package
    `);
    await transaction.commit();
    return {
      rowsAffected: deleteResult.rowsAffected[0],
      deleted: deleteResult.recordset,
      packageDeleted: deletePackageResult.recordset,
      packageRowsAffected: deletePackageResult.rowsAffected[0],
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

async function getCustomDataById(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM tb_CILT_custom WHERE id = @id");

    if (result.recordset.length === 0) {
      return null;
    }

    const data = result.recordset[0];

    try {
      data.headerParsed = data.header ? JSON.parse(data.header) : {};
      data.itemParsed = data.item ? JSON.parse(data.item) : [];
    } catch (err) {
      logger.warn("Error parsing JSON fields:", err);
      data.headerParsed = {};
      data.itemParsed = [];
    }

    return data;
  } catch (error) {
    logger.error("Error fetching custom data by ID:", error);
    throw error;
  }
}

async function getCustomDataWithParsed() {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM tb_CILT_custom");

    return result.recordset.map(data => {
      try {
        data.headerParsed = data.header ? JSON.parse(data.header) : {};
        data.itemParsed = data.item ? JSON.parse(data.item) : [];
      } catch (err) {
        logger.warn(`Error parsing JSON for package ID ${data.id}:`, err);
        data.headerParsed = {};
        data.itemParsed = [];
      }
      return data;
    });
  } catch (error) {
    logger.error("Error fetching custom data with parsed:", error);
    throw error;
  }
}

async function getCustomPackages() {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM tb_CILT_custom_packages");
    return result.recordset;
  } catch (error) {
    logger.error("Error fetching custom packages:", error);
    throw error;
  }
}

async function getCustomPackageById(id) {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("SELECT * FROM tb_CILT_custom_packages WHERE id = @id");

    if (result.recordset.length === 0) {
      return null;
    }

    const data = result.recordset[0];
    try {
      data.headerParsed = data.header ? JSON.parse(data.header) : {};
      data.itemParsed = data.item ? JSON.parse(data.item) : [];
    } catch (err) {
      logger.warn("Error parsing JSON fields:", err);
      data.headerParsed = {};
      data.itemParsed = [];
    }
    return data;
  } catch (error) {
    logger.error("Error fetching custom package by ID:", error);
    throw error;
  }
}

// ciltCustomService.js

async function createCustomPackage(data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const {
      plant,
      machine,
      line,
      package: packageName,
      header,
      item
    } = data;

    const headerStr = typeof header === 'string'
      ? header
      : JSON.stringify(header || {});
    const itemStr = typeof item === 'string'
      ? item
      : JSON.stringify(item || []);

    // 1. Cari metadata dulu (tb_CILT_custom) dengan kombinasi plant+line+machine+package
    const metaReq = transaction.request();
    metaReq.input("plant", sql.VarChar, plant);
    metaReq.input("machine", sql.VarChar, machine);
    metaReq.input("line", sql.VarChar, line);
    metaReq.input("package", sql.VarChar, packageName);

    const metaResult = await metaReq.query(`
      SELECT TOP 1 *
      FROM tb_CILT_custom
      WHERE plant = @plant
        AND machine = @machine
        AND line = @line
        AND package = @package
      ORDER BY id DESC
    `);

    let packageId;

    // 2. Jika metadata BELUM ada → buat sekalian (pakai header/item yang sama)
    if (metaResult.recordset.length === 0) {
      const insertMetaReq = transaction.request();
      insertMetaReq.input("plant", sql.VarChar, plant);
      insertMetaReq.input("machine", sql.VarChar, machine);
      insertMetaReq.input("line", sql.VarChar, line);
      insertMetaReq.input("package", sql.VarChar, packageName);
      insertMetaReq.input("header", sql.NVarChar(sql.MAX), headerStr);
      insertMetaReq.input("item", sql.NVarChar(sql.MAX), itemStr);

      const metaInsertResult = await insertMetaReq.query(`
        INSERT INTO tb_CILT_custom
          (plant, line, machine, package, header, item)
        OUTPUT inserted.*
        VALUES
          (@plant, @line, @machine, @package, @header, @item)
      `);

      packageId = metaInsertResult.recordset[0].id;
    } else {
      packageId = metaResult.recordset[0].id;
    }

    // 3. Cek apakah sudah ada row designer dengan ID ini
    const existingDesignerReq = transaction.request();
    existingDesignerReq.input("id", sql.Int, packageId);
    const existingDesignerResult = await existingDesignerReq.query(`
      SELECT * FROM tb_CILT_custom_packages WHERE id = @id
    `);

    let designerResult;

    if (existingDesignerResult.recordset.length === 0) {
      // 4a. Belum ada → INSERT dengan ID yang sama (pakai IDENTITY_INSERT)
      const insertDesignerReq = transaction.request();
      insertDesignerReq.input("id", sql.Int, packageId);
      insertDesignerReq.input("plant", sql.VarChar, plant);
      insertDesignerReq.input("machine", sql.VarChar, machine);
      insertDesignerReq.input("line", sql.VarChar, line);
      insertDesignerReq.input("package", sql.VarChar, packageName);
      insertDesignerReq.input("header", sql.NVarChar(sql.MAX), headerStr);
      insertDesignerReq.input("item", sql.NVarChar(sql.MAX), itemStr);

      designerResult = await insertDesignerReq.query(`
        SET IDENTITY_INSERT tb_CILT_custom_packages ON;

        INSERT INTO tb_CILT_custom_packages
          (id, plant, line, machine, package, header, item)
        OUTPUT inserted.*
        VALUES
          (@id, @plant, @line, @machine, @package, @header, @item);

        SET IDENTITY_INSERT tb_CILT_custom_packages OFF;
      `);
    } else {
      // 4b. Sudah ada designer ID yang sama → tinggal UPDATE saja
      const updateDesignerReq = transaction.request();
      updateDesignerReq.input("id", sql.Int, packageId);
      updateDesignerReq.input("plant", sql.VarChar, plant);
      updateDesignerReq.input("machine", sql.VarChar, machine);
      updateDesignerReq.input("line", sql.VarChar, line);
      updateDesignerReq.input("package", sql.VarChar, packageName);
      updateDesignerReq.input("header", sql.NVarChar(sql.MAX), headerStr);
      updateDesignerReq.input("item", sql.NVarChar(sql.MAX), itemStr);

      designerResult = await updateDesignerReq.query(`
        UPDATE tb_CILT_custom_packages
        SET plant = @plant,
            line = @line,
            machine = @machine,
            package = @package,
            header = @header,
            item = @item,
            updated_at = GETDATE()
        OUTPUT inserted.*
        WHERE id = @id
      `);
    }

    await transaction.commit();

    return {
      rowsAffected: designerResult.rowsAffected[0],
      inserted: designerResult.recordset,
    };
  } catch (error) {
    logger.error("Error creating custom package:", error);
    if (transaction) await transaction.rollback();
    throw error;
  }
}

async function updateCustomPackage(id, data) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const {
      plant,
      machine,
      line,
      package: packageName,
      header,
      item
    } = data;

    const headerStr = typeof header === 'string'
      ? header
      : JSON.stringify(header || {});
    const itemStr = typeof item === 'string'
      ? item
      : JSON.stringify(item || []);

    // 1. Update designer
    const req = transaction.request();
    req.input("id", sql.Int, id);
    req.input("plant", sql.VarChar, plant);
    req.input("machine", sql.VarChar, machine);
    req.input("line", sql.VarChar, line);
    req.input("package", sql.VarChar, packageName);
    req.input("header", sql.NVarChar(sql.MAX), headerStr);
    req.input("item", sql.NVarChar(sql.MAX), itemStr);

    const result = await req.query(`
      UPDATE tb_CILT_custom_packages
      SET plant = @plant, line = @line, machine = @machine,
          package = @package, header = @header, item = @item,
          updated_at = GETDATE()
      OUTPUT inserted.*
      WHERE id = @id
    `);

    // 2. Sync ke metadata juga (kalau ada row-nya)
    const metaReq = transaction.request();
    metaReq.input("id", sql.Int, id);
    metaReq.input("plant", sql.VarChar, plant);
    metaReq.input("machine", sql.VarChar, machine);
    metaReq.input("line", sql.VarChar, line);
    metaReq.input("package", sql.VarChar, packageName);
    metaReq.input("header", sql.NVarChar(sql.MAX), headerStr);
    metaReq.input("item", sql.NVarChar(sql.MAX), itemStr);

    await metaReq.query(`
      UPDATE tb_CILT_custom
      SET plant = @plant, line = @line, machine = @machine,
          package = @package, header = @header, item = @item
      WHERE id = @id
    `);

    await transaction.commit();
    return {
      rowsAffected: result.rowsAffected[0],
      updated: result.recordset,
    };
  } catch (error) {
    logger.error("Error updating custom package:", error);
    if (transaction) await transaction.rollback();
    throw error;
  }
}

async function deleteCustomPackage(id) {
  let transaction;
  try {
    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const req = transaction.request();
    req.input("id", sql.Int, id);
    const selectResult = await req.query(`
      SELECT * FROM tb_CILT_custom_packages WHERE id = @id
    `);

    if (selectResult.recordset.length === 0) {
      throw new Error(`Package with ID ${id} not found`);
    }

    const packageInfo = selectResult.recordset[0];
    const result = await req.query(`
      DELETE FROM tb_CILT_custom_packages
      OUTPUT deleted.*
      WHERE id = @id
    `);

    const req2 = transaction.request();
    req2.input("plant", sql.VarChar, packageInfo.plant);
    req2.input("machine", sql.VarChar, packageInfo.machine);
    req2.input("line", sql.VarChar, packageInfo.line);
    req2.input("package", sql.VarChar, packageInfo.package);

    const deleteMetadataResult = await req2.query(`
      DELETE FROM tb_CILT_custom
      OUTPUT deleted.*
      WHERE plant = @plant 
        AND machine = @machine 
        AND line = @line 
        AND package = @package
    `);

    await transaction.commit();
    return {
      rowsAffected: result.rowsAffected[0],
      deleted: result.recordset,
      metadataDeleted: deleteMetadataResult.recordset,
      metadataRowsAffected: deleteMetadataResult.rowsAffected[0],
    };
  } catch (error) {
    logger.error("Error deleting custom package:", error);
    if (transaction) await transaction.rollback();
    throw error;
  }
}

module.exports = {
  getCustomData,
  createCustomData,
  updateCustomData,
  deleteCustomData,
  updatePackageWithRelations,
  getCustomDataById,
  getCustomDataWithParsed,
  getCustomPackages,
  getCustomPackageById,
  createCustomPackage,
  updateCustomPackage,
  deleteCustomPackage,
};
