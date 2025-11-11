const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getLineMaster() {
  try {
    const pool = await getPool();
    const request = pool.request();

    let query = `
      SELECT DISTINCT line FROM tb_CILT_package_master
    `;

    const result = await request.query(query);
    return result.recordset;
  } catch (error) {
    logger.error("Error fetching package master CILT:", error);
    throw error;
  }
}

async function createFrom(data) {
  let transaction;
  try {
    const { line, line_reference, packages } = data || {};

    const selectedPackages = Array.isArray(packages)
      ? packages
          .filter(
            (p) => p !== undefined && p !== null && String(p).trim() !== ""
          )
          .map((p) => String(p).trim())
      : [];

    if (!line || !line_reference) {
      throw new Error("line dan line_reference wajib diisi");
    }
    if (selectedPackages.length === 0) {
      return {
        rowsAffected: 0,
        inserted: [],
        gnr: { rowsAffected: 0, data: [] },
        checklist: { rowsAffected: 0, data: [] },
      };
    }

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    // 1) Insert ke tb_CILT_package_master sesuai package yang dipilih
    const reqPkg = transaction.request();
    reqPkg.input("targetLine", sql.NVarChar(200), line);
    reqPkg.input("lineRef", sql.NVarChar(200), line_reference);

    const pkgParams = selectedPackages.map((_, i) => `@pkg${i}`).join(", ");
    selectedPackages.forEach((pkg, i) => {
      reqPkg.input(`pkg${i}`, sql.NVarChar(200), pkg);
    });

    const insertPkgQuery = `
      INSERT INTO tb_CILT_package_master (plant, line, machine, package)
      OUTPUT inserted.id, inserted.plant, inserted.line, inserted.machine, inserted.package
      SELECT s.plant, @targetLine, s.machine, s.package
      FROM tb_CILT_package_master s
      WHERE s.line = @lineRef
        AND s.package IN (${pkgParams})
        AND NOT EXISTS (
          SELECT 1
          FROM tb_CILT_package_master x
          WHERE x.line = @targetLine
            AND x.machine = s.machine
            AND x.package = s.package
            AND x.plant = s.plant
        )
    `;
    const pkgResult = await reqPkg.query(insertPkgQuery);

    // 2) Jika ada "PERFORMA RED AND GREEN", copy dari tb_CILT_gnr_master
    const hasGnr = selectedPackages.some(
      (p) => p.toUpperCase() === "PERFORMA RED AND GREEN"
    );
    let gnrResult;
    if (hasGnr) {
      const reqGnr = transaction.request();
      reqGnr.input("targetLine", sql.NVarChar(200), line);
      reqGnr.input("lineRef", sql.NVarChar(200), line_reference);
      reqGnr.input("gnrType", sql.NVarChar(200), "PERFORMA RED AND GREEN");

      const insertGnrQuery = `
        INSERT INTO tb_CILT_gnr_master
          (plant, line, machine, package_type, activity, frekuensi, status, good, need, reject)
        OUTPUT inserted.id, inserted.plant, inserted.line, inserted.machine, inserted.package_type,
               inserted.activity, inserted.frekuensi, inserted.status, inserted.good, inserted.need,
               inserted.reject
        SELECT s.plant, @targetLine, s.machine, s.package_type, s.activity, s.frekuensi, s.status, s.good, s.need, s.reject
        FROM tb_CILT_gnr_master s
        WHERE s.line = @lineRef
          AND s.package_type = @gnrType
          AND NOT EXISTS (
            SELECT 1
            FROM tb_CILT_gnr_master x
            WHERE x.line = @targetLine
              AND x.plant = s.plant
              AND x.machine = s.machine
              AND x.package_type = s.package_type
              AND x.activity = s.activity
          )
        ORDER BY s.id ASC
      `;
      gnrResult = await reqGnr.query(insertGnrQuery);
    }

    // 3) Jika ada "CHECKLIST CILT", copy dari tb_CILT_checklist_master
    const hasChecklist = selectedPackages.some(
      (p) => p.toUpperCase() === "CHECKLIST CILT"
    );
    let checklistResult;
    if (hasChecklist) {
      const reqChecklist = transaction.request();
      reqChecklist.input("targetLine", sql.NVarChar(200), line);
      reqChecklist.input("lineRef", sql.NVarChar(200), line_reference);
      reqChecklist.input("checkType", sql.NVarChar(200), "CHECKLIST CILT");

      const insertChecklistQuery = `
        INSERT INTO tb_CILT_checklist_master
          (plant, line, machine, package_type, job_type, componen, standart, pic, duration, maintanance_interval)
        OUTPUT inserted.id, inserted.plant, inserted.line, inserted.machine, inserted.package_type,
               inserted.job_type, inserted.componen, inserted.standart, inserted.pic, inserted.duration,
               inserted.maintanance_interval
        SELECT s.plant, @targetLine, s.machine, s.package_type, s.job_type, s.componen, s.standart, s.pic, s.duration, s.maintanance_interval
        FROM tb_CILT_checklist_master s
        WHERE s.line = @lineRef
          AND s.package_type = @checkType
          AND NOT EXISTS (
            SELECT 1
            FROM tb_CILT_checklist_master x
            WHERE x.line = @targetLine
              AND x.plant = s.plant
              AND x.machine = s.machine
              AND x.package_type = s.package_type
              AND x.job_type = s.job_type
              AND x.componen = s.componen
          )
        ORDER BY s.id ASC
      `;
      checklistResult = await reqChecklist.query(insertChecklistQuery);
    }

    await transaction.commit();

    return {
      rowsAffected: (pkgResult.rowsAffected && pkgResult.rowsAffected[0]) || 0,
      inserted: pkgResult.recordset || [],
      gnr: {
        rowsAffected: gnrResult?.rowsAffected?.[0] || 0,
        data: gnrResult?.recordset || [],
      },
      checklist: {
        rowsAffected: checklistResult?.rowsAffected?.[0] || 0,
        data: checklistResult?.recordset || [],
      },
    };
  } catch (error) {
    logger.error("Error creating package:", error);
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

async function deleteLine(line) {
  let transaction;
  try {
    const lineVal = typeof line === "string" ? line.trim() : "";
    if (!lineVal) {
      const err = new Error("parameter line wajib diisi");
      err.status = 400;
      throw err;
    }

    const pool = await getPool();
    transaction = pool.transaction();
    await transaction.begin();

    const reqChecklist = transaction.request();
    reqChecklist.input("line", sql.NVarChar(200), lineVal);
    const delChecklist = await reqChecklist.query(`
      DELETE FROM tb_CILT_checklist_master
      OUTPUT deleted.id, deleted.plant, deleted.line, deleted.machine, deleted.package_type,
             deleted.job_type, deleted.componen, deleted.standart, deleted.pic, deleted.duration,
             deleted.maintanance_interval
      WHERE line = @line
    `);

    const reqGnr = transaction.request();
    reqGnr.input("line", sql.NVarChar(200), lineVal);
    const delGnr = await reqGnr.query(`
      DELETE FROM tb_CILT_gnr_master
      OUTPUT deleted.id, deleted.plant, deleted.line, deleted.machine, deleted.package_type,
             deleted.activity, deleted.frekuensi, deleted.status, deleted.good, deleted.need,
             deleted.reject
      WHERE line = @line
    `);

    const reqPkg = transaction.request();
    reqPkg.input("line", sql.NVarChar(200), lineVal);
    const delPkg = await reqPkg.query(`
      DELETE FROM tb_CILT_package_master
      OUTPUT deleted.id, deleted.plant, deleted.line, deleted.machine, deleted.package
      WHERE line = @line
    `);

    const checklistCount = delChecklist.rowsAffected?.[0] || 0;
    const gnrCount = delGnr.rowsAffected?.[0] || 0;
    const pkgCount = delPkg.rowsAffected?.[0] || 0;
    const total = checklistCount + gnrCount + pkgCount;

    if (total === 0) {
      await transaction.rollback();
      const err = new Error("Tidak ada data dengan line tersebut");
      err.status = 404;
      throw err;
    }

    await transaction.commit();
    return {
      line: lineVal,
      totalDeleted: total,
      package: { rowsAffected: pkgCount, data: delPkg.recordset || [] },
      gnr: { rowsAffected: gnrCount, data: delGnr.recordset || [] },
      checklist: {
        rowsAffected: checklistCount,
        data: delChecklist.recordset || [],
      },
    };
  } catch (error) {
    logger.error("Error deleteLine:", error);
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
  createFrom,
  deleteLine,
  getLineMaster,
};
