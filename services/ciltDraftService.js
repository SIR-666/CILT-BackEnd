const sql = require("mssql");
const getPool = require("../config/pool");

// Helper: Parse JSON field safely
function parseJsonField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try {
            const parsed = JSON.parse(field);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

// Check if draft has meaningful inspection data
function hasMeaningfulData(inspectionData) {
    const inspection = parseJsonField(inspectionData);
    // Draft valid if has inspection data
    // descriptionData is optional and can be empty
    return inspection.length > 0;
}

// Auto-save draft (insert/update by processOrder + packageType)
async function autoSaveDraft(data) {
    const pool = await getPool();

    // Validate meaningful data
    if (!hasMeaningfulData(data.inspectionData)) {
        console.log("[autoSaveDraft] Skipping save - no inspection data");
        return { id: null, mode: "skip", reason: "no_inspection_data" };
    }

    const inspectionJson = JSON.stringify(data.inspectionData || []);
    // descriptionData is optional - save as empty array if not provided
    const descriptionJson = JSON.stringify(data.descriptionData || []);

    // If draft ID is provided, update by ID
    if (data.id) {
        const updateByIdResult = await pool.request()
            .input("id", sql.Int, data.id)
            .input("inspectionData", sql.NVarChar, inspectionJson)
            .input("descriptionData", sql.NVarChar, descriptionJson)
            .input("currentShift", sql.NVarChar, data.shift)
            .input("plant", sql.NVarChar, data.plant)
            .input("line", sql.NVarChar, data.line)
            .input("machine", sql.NVarChar, data.machine)
            .input("product", sql.NVarChar, data.product || "")
            .input("batch", sql.NVarChar, data.batch || "")
            .query(`
                UPDATE tb_CILT_DRAFT
                SET inspectionData = @inspectionData,
                    descriptionData = @descriptionData,
                    currentShift = @currentShift,
                    plant = @plant,
                    line = @line,
                    machine = @machine,
                    product = @product,
                    batch = @batch,
                    updatedAt = GETDATE()
                WHERE id = @id
            `);

        const updatedRows = updateByIdResult?.rowsAffected?.[0] || 0;
        if (updatedRows > 0) {
            console.log(`[autoSaveDraft] Updated draft ID: ${data.id}`);
            return { id: data.id, mode: "update-by-id" };
        }

        // Stale ID: continue with upsert logic below.
        console.log(`[autoSaveDraft] Draft ID ${data.id} not found, fallback to upsert by context`);
    }

    // Check if draft exists by processOrder + packageType
    const check = await pool.request()
        .input("processOrder", sql.NVarChar, data.processOrder)
        .input("packageType", sql.NVarChar, data.packageType)
        .input("line", sql.NVarChar, data.line)
        .input("machine", sql.NVarChar, data.machine)
        .input("currentShift", sql.NVarChar, data.shift)
        .query(`
            SELECT TOP 1 id, currentShift, sourceShift
            FROM tb_CILT_DRAFT
            WHERE processOrder = @processOrder
              AND packageType = @packageType
              AND line = @line
              AND machine = @machine
              AND currentShift = @currentShift
        `);

    // UPDATE existing draft
    if (check.recordset.length > 0) {
        const existingDraft = check.recordset[0];
        const id = existingDraft.id;

        await pool.request()
            .input("id", sql.Int, id)
            .input("inspectionData", sql.NVarChar, inspectionJson)
            .input("descriptionData", sql.NVarChar, descriptionJson)
            .input("currentShift", sql.NVarChar, data.shift)
            .input("plant", sql.NVarChar, data.plant)
            .input("line", sql.NVarChar, data.line)
            .input("machine", sql.NVarChar, data.machine)
            .input("product", sql.NVarChar, data.product || "")
            .input("batch", sql.NVarChar, data.batch || "")
            .query(`
                UPDATE tb_CILT_DRAFT
                SET inspectionData = @inspectionData,
                    descriptionData = @descriptionData,
                    currentShift = @currentShift,
                    plant = @plant,
                    line = @line,
                    machine = @machine,
                    product = @product,
                    batch = @batch,
                    updatedAt = GETDATE()
                WHERE id = @id
            `);

        console.log(`[autoSaveDraft] Updated existing draft ID: ${id}`);
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
        .input("inspectionData", sql.NVarChar, inspectionJson)
        .input("descriptionData", sql.NVarChar, descriptionJson)
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

    const newId = insert.recordset[0].id;
    console.log(`[autoSaveDraft] Inserted new draft ID: ${newId}`);
    return { id: newId, mode: "insert" };
}

// Get all drafts with valid inspection data
async function getAllDraft() {
    const pool = await getPool();
    const res = await pool.request().query(`
        SELECT *
        FROM tb_CILT_DRAFT
        WHERE inspectionData IS NOT NULL 
          AND inspectionData != '[]'
          AND LEN(inspectionData) > 2
        ORDER BY updatedAt DESC
    `);

    console.log(`[getAllDraft] Found ${res.recordset.length} valid drafts`);
    return res.recordset;
}

// Get draft by ID with JSON parsing
async function getDraftById(id) {
    const pool = await getPool();
    const res = await pool.request()
        .input("id", sql.Int, id)
        .query(`SELECT * FROM tb_CILT_DRAFT WHERE id=@id`);

    if (res.recordset.length === 0) {
        console.log(`[getDraftById] Draft ID ${id} not found`);
        return null;
    }

    const draft = res.recordset[0];

    // Parse JSON fields
    return {
        ...draft,
        inspectionData: parseJsonField(draft.inspectionData),
        descriptionData: parseJsonField(draft.descriptionData) // Can be empty array
    };
}

// Delete draft by ID
async function deleteDraft(id) {
    const pool = await getPool();
    await pool.request()
        .input("id", sql.Int, id)
        .query(`DELETE FROM tb_CILT_DRAFT WHERE id=@id`);

    console.log(`[deleteDraft] Deleted draft ID: ${id}`);
}

// Submit draft to main table with validation
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

        // Validate draft has inspection data (descriptionData is optional)
        if (!hasMeaningfulData(d.inspectionData)) {
            throw new Error("Cannot submit draft with no inspection data");
        }

        // Insert to main table
        // Use descriptionData if available, otherwise use empty string
        const remarks = d.descriptionData && d.descriptionData !== '[]'
            ? d.descriptionData
            : '';

        await tx.request()
            .input("processOrder", d.processOrder)
            .input("packageType", d.packageType)
            .input("plant", d.plant)
            .input("line", d.line)
            .input("shift", d.currentShift) // Use currentShift, not sourceShift
            .input("machine", d.machine)
            .input("product", d.product)
            .input("batch", d.batch)
            .input("inspectionData", d.inspectionData)
            .input("remarks", remarks)
            .input("status", 0)
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

        // Delete draft
        await tx.request()
            .input("id", sql.Int, id)
            .query(`DELETE FROM tb_CILT_DRAFT WHERE id=@id`);

        await tx.commit();
        console.log(`[submitDraft] Successfully submitted draft ID: ${id}`);
        return { success: true, message: "Draft submitted successfully" };

    } catch (e) {
        await tx.rollback();
        console.error(`[submitDraft] Error:`, e.message);
        throw e;
    }
}

// Get drafts for shift change
async function getDraftsForShiftChange(currentShift) {
    const pool = await getPool();
    const res = await pool.request()
        .input("currentShift", sql.NVarChar, currentShift)
        .query(`
            SELECT *
            FROM tb_CILT_DRAFT
            WHERE sourceShift != @currentShift
              AND inspectionData IS NOT NULL 
              AND inspectionData != '[]'
              AND LEN(inspectionData) > 2
            ORDER BY updatedAt DESC
        `);

    return res.recordset;
}

// Cleanup empty drafts (no meaningful inspection data)
async function cleanupEmptyDrafts() {
    const pool = await getPool();

    const result = await pool.request().query(`
        DELETE FROM tb_CILT_DRAFT
        WHERE inspectionData IS NULL 
           OR inspectionData = '[]' 
           OR inspectionData = ''
           OR LEN(inspectionData) < 3
    `);

    console.log(`[cleanupEmptyDrafts] Deleted ${result.rowsAffected[0]} empty drafts`);
    return result.rowsAffected[0];
}

module.exports = {
    autoSaveDraft,
    getAllDraft,
    getDraftById,
    deleteDraft,
    submitDraft,
    getDraftsForShiftChange,
    cleanupEmptyDrafts,
    hasMeaningfulData,
};
