const sql = require("mssql");
const getPool = require("../config/pool");

async function getMaster(page) {
    const pool = await getPool();

    const result = await pool
        .request()
        .input("page", sql.Int, page)
        .query(`
            SELECT 
                id,
                page,
                section,
                sub_section,
                parameter_name,
                range_text,
                unit,
                value_type,
                min_value,
                max_value,
                exact_value,
                interval_note,
                order_no
            FROM CILT_combi_xg_master
            WHERE page = @page AND is_active = 1
            ORDER BY section, order_no ASC
        `);

    return result.recordset;
}

module.exports = {
    getMaster,
};
