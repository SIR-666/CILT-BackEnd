const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getDowntimeList() {
  try {
    const pool = await getPool();
    const downtimeList = await pool
      .request()
      .query(`SELECT * FROM [tb_CILT_downtime_master]`);

    return downtimeList.recordsets;
  } catch (error) {
    console.error("Error in getDowntimeList:", error);
    return [];
  }
}

async function getDowntimeMaster(line, category, mesin) {
  try {
    const pool = await getPool();
    const downtime = await pool
      .request()
      .input("line", sql.VarChar, line)
      .input("category", sql.VarChar, `%${category}%`)
      .input("mesin", sql.VarChar, mesin)
      .query(
        `SELECT * FROM [DowntimeMaster]
         WHERE line = @line
         AND downtime_category LIKE @category
         AND mesin = @mesin`
      );

    return downtime.recordsets;
  } catch (error) {
    console.error("Error in getDowntimeMaster:", error);
    return [];
  }
}

async function getDowntimeMasterByLine(line) {
  try {
    const pool = await getPool();
    const downtime = await pool
      .request()
      .input("line", sql.VarChar, line)
      .query(
        `SELECT * FROM [DowntimeMaster]
         WHERE line = @line`
      );

    return downtime.recordsets;
  } catch (error) {
    console.error("Error in getDowntimeMasterByLine:", error);
    return [];
  }
}

async function createDowntime(order) {
  try {
    const pool = await getPool();

    const existingDowntime = await pool
      .request()
      .input("plant", order.plant)
      .input("shift", order.shift)
      .input("line", order.line)
      .input("newDate", order.date)
      .input("minutes", order.minutes).query(`
            SELECT * FROM [tb_CILT_downtime]
            WHERE plant = @plant
            AND shift = @shift
            AND line = @line
            AND [date] < DATEADD(MINUTE, CAST(@minutes AS INT), @newDate)
            AND DATEADD(MINUTE, CAST([minutes] AS INT), [date]) > @newDate
        `);

    if (existingDowntime.recordset.length > 0) {
      throw new Error("Downtime conflicts with existing entries.");
    }

    const result = await pool
      .request()
      .input("plant", order.plant)
      .input("date", order.date ? order.date : null) // Use DATETIME
      .input("shift", order.shift)
      .input("line", order.line)
      .input("downtime_category", order.downtime_category)
      .input("mesin", order.mesin)
      .input("jenis", order.jenis)
      .input("keterangan", order.keterangan)
      .input("minutes", order.minutes).query(`INSERT INTO tb_CILT_downtime (
                plant,
                date,
                shift,
                line,
                downtime_category,
                mesin,
                jenis,
                keterangan,
                minutes
              ) OUTPUT inserted.id VALUES (
                @plant,
                @date,
                @shift,
                @line,
                @downtime_category,
                @mesin,
                @jenis,
                @keterangan,
                @minutes
              );`);

    const newOrder = { ...order, id: result.recordset[0].id };
    console.log("New record created with id: ", newOrder.id);
    return newOrder;
  } catch (err) {
    console.error("Error creating CILT downtime record:", err);
  }
}

async function updateDowntime(order) {
  try {
    const pool = await getPool();

    // Cek konflik waktu (selain id yang sedang diupdate)
    const existingDowntime = await pool
      .request()
      .input("plant", order.plant)
      .input("shift", order.shift)
      .input("line", order.line)
      .input("newDate", order.date)
      .input("minutes", order.minutes)
      .input("id", order.id).query(`
        SELECT * FROM [tb_CILT_downtime]
        WHERE plant = @plant
          AND shift = @shift
          AND line = @line
          AND id != @id
          AND [date] < DATEADD(MINUTE, CAST(@minutes AS INT), @newDate)
          AND DATEADD(MINUTE, CAST([minutes] AS INT), [date]) > @newDate
      `);

    if (existingDowntime.recordset.length > 0) {
      throw new Error("Downtime conflicts with existing entries.");
    }

    // Lakukan update
    await pool
      .request()
      .input("id", order.id)
      .input("plant", order.plant)
      .input("date", order.date)
      .input("shift", order.shift)
      .input("line", order.line)
      .input("downtime_category", order.downtime_category)
      .input("mesin", order.mesin)
      .input("jenis", order.jenis)
      .input("keterangan", order.keterangan)
      .input("minutes", order.minutes).query(`
        UPDATE tb_CILT_downtime
        SET
          plant = @plant,
          date = @date,
          shift = @shift,
          line = @line,
          downtime_category = @downtime_category,
          mesin = @mesin,
          jenis = @jenis,
          keterangan = @keterangan,
          minutes = @minutes
        WHERE id = @id
      `);

    console.log("Record updated with id: ", order.id);
    return order;
  } catch (err) {
    console.error("Error updating CILT downtime record:", err);
    throw err;
  }
}

async function getDowntimeOrder() {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query(`SELECT * FROM tb_CILT_downtime ORDER BY [DATE] DESC`);

    const records = result.recordset;

    const grouped = {};

    records.forEach((item) => {
      const dateOnly = item.Date.toISOString().split("T")[0]; // hanya ambil YYYY-MM-DD
      const key = `${item.Plant}_${dateOnly}_${item.Shift}_${item.Line}`;

      if (!grouped[key]) {
        grouped[key] = {
          plant: item.Plant,
          date: dateOnly,
          shift: item.Shift,
          line: item.Line,
          data: [],
        };
      }

      grouped[key].data.push({
        id: item.id,
        plant: item.Plant,
        line: item.Line,
        start_time: item.Date,
        end_time: new Date(
          new Date(item.Date).getTime() + parseInt(item.Minutes) * 60000
        ),
        downtime_category: item.Downtime_Category,
        mesin: item.Mesin,
        jenis: item.Jenis,
        keterangan: item.Keterangan,
        minutes: item.Minutes,
        completed: item.Completed,
      });
    });

    const shiftLabelMap = {
      I: "Shift 1",
      II: "Shift 2",
      III: "Shift 3",
    };

    const groupedArray = Object.values(grouped).map((item, index) => ({
      id: index + 1,
      ...item,
      shift: shiftLabelMap[item.shift] || item.shift, // convert Roman to Shift X
    }));
    return groupedArray;
  } catch (error) {
    console.error("Error fetching grouped downtime data:", error);
  }
}

async function getDowntimeData(plant, line, date, shift) {
  try {
    const pool = await getPool();
    console.log(plant, line, date, shift);
    const downtime = await pool
      .request()
      .input("plant", sql.VarChar, plant)
      .input("line", sql.VarChar, line)
      .input("date", sql.VarChar, date) // format: 'YYYY-MM-DD'
      .input("shift", sql.VarChar, shift)
      .query(
        `SELECT * FROM [tb_CILT_downtime]
          WHERE plant = @plant
          AND line = @line
          AND CAST([date] AS DATE) = CAST(@date AS DATE)
          AND shift = @shift
          order by [date] asc`
      );

    return downtime.recordsets;
  } catch (error) {
    console.error("Error in get downtime data:", error);
    return [];
  }
}

async function deleteDowntime(id) {
  try {
    const pool = await getPool();

    const result = await pool.request().input("id", id).query(`
        DELETE FROM tb_CILT_downtime
        WHERE id = @id
      `);

    if (result.rowsAffected[0] === 0) {
      throw new Error(`No record found with id ${id}`);
    }

    console.log(`Record with id ${id} deleted successfully.`);
    return { success: true, id };
  } catch (err) {
    console.error("Error deleting downtime record:", err);
    throw err;
  }
}

module.exports = {
  getDowntimeList,
  getDowntimeMaster,
  getDowntimeMasterByLine,
  createDowntime,
  updateDowntime,
  getDowntimeOrder,
  getDowntimeData,
  deleteDowntime,
};
