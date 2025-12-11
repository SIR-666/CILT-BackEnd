const db = require("../config/db");

exports.getPressureCheck = async (line) => {
    const sql = `
    SELECT id, plant, line, machine, parameter_name, sort_order 
    FROM tb_CILT_pressure_check
    WHERE line = ?
    ORDER BY sort_order ASC
  `;

    const [rows] = await db.execute(sql, [line]);
    return rows;
};

exports.getPressureCheck30Min = async (line) => {
    const sql = `
    SELECT id, plant, line, machine, parameter_name, sort_order 
    FROM tb_CILT_pressure_check_30min
    WHERE line = ?
    ORDER BY sort_order ASC
  `;

    const [rows] = await db.execute(sql, [line]);
    return rows;
};
