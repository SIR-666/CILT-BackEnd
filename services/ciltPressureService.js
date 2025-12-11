const sql = require("mssql");
const getPool = require("../config/pool");

async function getPressureCheck(line) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("line", sql.VarChar, line)
    .query(`
      SELECT *
      FROM tb_CILT_pressure_check
      WHERE line = @line
      ORDER BY id ASC
    `);

  return result.recordset;
}

async function getPressureCheck30Min(line) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("line", sql.VarChar, line)
    .query(`
      SELECT *
      FROM tb_CILT_pressure_check_30min
      WHERE line = @line
      ORDER BY sort_order ASC
    `);

  return result.recordset;
}

module.exports = {
  getPressureCheck,
  getPressureCheck30Min,
};
