exports.getPressureCheck = async (line) => {
  const query = `
    SELECT *
    FROM tb_CILT_pressure_check
    WHERE REPLACE(line, ' ', '') = REPLACE(@line, '_', '')
    ORDER BY sort_order ASC
  `;

  const params = { line };
  return await db.query(query, params);
};

exports.getPressureCheck30Min = async (line) => {
  const query = `
    SELECT *
    FROM tb_CILT_pressure_check_30min
    WHERE REPLACE(line, ' ', '') = REPLACE(@line, '_', '')
    ORDER BY sort_order ASC
  `;

  const params = { line };
  return await db.query(query, params);
};
