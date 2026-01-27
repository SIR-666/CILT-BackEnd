const sql = require("mssql");
const getPool = require("../config/pool");

async function autoSaveDraft(data) {
    const pool = await getPool();

    if (data.id) {
        await pool.request()
            .input("id", sql.Int, data.id)
            .input("inspectionData", sql.NVarChar, JSON.stringify(data.inspectionData || []))
            .input("descriptionData", sql.NVarChar, JSON.stringify(data.descriptionData || []))
            .input("currentShift", sql.NVarChar, data.shift)
            .query(`
       UPDATE tb_CILT_DRAFT
       SET inspectionData = @inspectionData,
           descriptionData = @descriptionData,
           currentShift = @currentShift,
           updatedAt = GETDATE()
       WHERE id = @id
     `);

        return { id: data.id, mode: "update-by-id" };
    }

    // Check if draft already exists (by processOrder + packageType)
    const check = await pool.request()
        .input("processOrder", sql.NVarChar, data.processOrder)
        .input("packageType", sql.NVarChar, data.packageType)
        .query(`
            SELECT TOP 1 id 
            FROM tb_CILT_DRAFT
            WHERE processOrder = @processOrder
              AND packageType = @packageType
        `);

    // UPDATE existing draft
    if (check.recordset.length > 0) {
        const id = check.recordset[0].id;

        await pool.request()
            .input("id", sql.Int, id)
            .input("inspectionData", sql.NVarChar, JSON.stringify(data.inspectionData || []))
            .input("descriptionData", sql.NVarChar, JSON.stringify(data.descriptionData || []))
            .input("currentShift", sql.NVarChar, data.shift)
            .input("plant", sql.NVarChar, data.plant)
            .input("line", sql.NVarChar, data.line)
            .input("machine", sql.NVarChar, data.machine)
            .query(`
                UPDATE tb_CILT_DRAFT
                SET inspectionData = @inspectionData,
                    descriptionData = @descriptionData,
                    currentShift = @currentShift,
                    plant = @plant,
                    line = @line,
                    machine = @machine,
                    updatedAt = GETDATE()
                WHERE id = @id
            `);

        return { id, mode: "update" };
    }

    // INSERT new draft
    const insert = await pool.request()
        .input("processOrder", sql.NVarChar, data.processOrder)
        .input("packageType", sql.NVarChar, data.packageType)
        .input("plant", sql.NVarChar, data.plant)
        .input("line", sql.NVarChar, data.line)
        .input("shift", sql.NVarChar, data.shift)
        .input("machine", sql.NVarChar, data.machine)
        .input("product", sql.NVarChar, data.product || "")
        .input("batch", sql.NVarChar, data.batch || "")
        .input("inspectionData", sql.NVarChar, JSON.stringify(data.inspectionData || []))
        .input("descriptionData", sql.NVarChar, JSON.stringify(data.descriptionData || []))
        .input("sourceShift", sql.NVarChar, data.shift)
        .input("currentShift", sql.NVarChar, data.shift)
        .query(`
            INSERT INTO tb_CILT_DRAFT (
                processOrder, packageType, plant, line, shift, machine,
                product, batch,
                inspectionData, descriptionData,
                sourceShift, currentShift, createdAt, updatedAt
            )
            OUTPUT inserted.id
            VALUES (
                @processOrder, @packageType, @plant, @line, @shift, @machine,
                @product, @batch,
                @inspectionData, @descriptionData,
                @sourceShift, @currentShift, GETDATE(), GETDATE()
            )
        `);

    return { id: insert.recordset[0].id, mode: "insert" };
}

async function getAllDraft() {
    const pool = await getPool();
    const res = await pool.request().query(`
    SELECT *
    FROM tb_CILT_DRAFT
    ORDER BY updatedAt DESC
  `);
    return res.recordset;
}

async function getDraftById(id) {
    const pool = await getPool();
    const res = await pool.request()
        .input("id", sql.Int, id)
        .query(`SELECT * FROM tb_CILT_DRAFT WHERE id=@id`);
    return res.recordset[0];
}

async function deleteDraft(id) {
    const pool = await getPool();
    await pool.request()
        .input("id", sql.Int, id)
        .query(`DELETE FROM tb_CILT_DRAFT WHERE id=@id`);
}

async function submitDraft(id) {
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
        const draft = await tx.request()
            .input("id", sql.Int, id)
            .query(`SELECT * FROM tb_CILT_DRAFT WHERE id=@id`);

        if (!draft.recordset.length) {
            throw new Error("Draft not found");
        }

        const d = draft.recordset[0];

        // insert ke tb_CILT
        await tx.request()
            .input("processOrder", d.processOrder)
            .input("packageType", d.packageType)
            .input("plant", d.plant)
            .input("line", d.line)
            .input("shift", d.currentShift)
            .input("machine", d.machine)
            .input("product", d.product)
            .input("batch", d.batch)
            .input("inspectionData", d.inspectionData)
            .input("remarks", d.descriptionData)
            .input("status", 1)
            .query(`
        INSERT INTO tb_CILT (
          processOrder, packageType, plant, line, shift,
          machine, product, batch,
          inspectionData, remarks, status
        )
        VALUES (
          @processOrder, @packageType, @plant, @line, @shift,
          @machine, @product, @batch,
          @inspectionData, @remarks, @status
        )
      `);

        // delete draft
        await tx.request()
            .input("id", sql.Int, id)
            .query(`DELETE FROM tb_CILT_DRAFT WHERE id=@id`);

        await tx.commit();
        return { success: true };

    } catch (e) {
        await tx.rollback();
        throw e;
    }
}

module.exports = {
    autoSaveDraft,
    getAllDraft,
    getDraftById,
    deleteDraft,
    submitDraft,
};