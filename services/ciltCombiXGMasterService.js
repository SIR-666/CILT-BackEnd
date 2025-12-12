const sql = require("mssql");
const getPool = require("../config/pool");

async function getMaster(page) {
    try {
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
               FROM dbo.tb_CILT_combi_xg_master
               WHERE page = @page
                 AND is_active = 1
               ORDER BY section, order_no ASC
           `);
        return result.recordset || [];
    } catch (error) {
        console.error("getMaster error:", error);
        throw error;
    }
}

module.exports = {
    getMaster,
};
