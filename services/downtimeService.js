const sql = require("mssql");
const logger = require("../config/logger");
const getPool = require("../config/pool");

async function getDowntimeList() {
  try {
    const pool = await getPool();
    const downtimeList = await pool
      .request()
      .query(`SELECT * FROM [dbo].[DowntimeMasterNew]`);

    return downtimeList.recordsets;
  } catch (error) {
    console.error("Error in getDowntimeList:", error);
    return [];
  }
}

async function getDowntimeMaster(line, category) {
  try {
    const pool = await getPool();
    const downtime = await pool
      .request()
      .input("line", sql.VarChar, line)
      .input("category", sql.VarChar, `%${category}%`)
      .query(
        `SELECT * FROM [dbo].[DowntimeMasterNew]
         WHERE line = @line
         AND downtime_category LIKE @category`
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
        `SELECT * FROM [dbo].[DowntimeMasterNew]
         WHERE line = @line`
      );

    return downtime.recordsets;
  } catch (error) {
    console.error("Error in getDowntimeMasterByLine:", error);
    return [];
  }
}

function getStartTime(order) {
  return order.start_time || order.date;
}

function getDurationMin(order) {
  const raw = order.duration_min ?? order.minutes;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function resolveRunId(pool, order, startTime) {
  if (order.run_id) {
    return order.run_id;
  }

  const result = await pool
    .request()
    .input("plant", sql.NVarChar, order.plant)
    .input("line", sql.NVarChar, order.line)
    .input("shift", sql.NVarChar, order.shift)
    .input("start_time", sql.VarChar, startTime)
    .query(`
      SELECT TOP 1 run_id
      FROM [dbo].[ProductionRun]
      WHERE plant = @plant
        AND line = @line
        AND shift = @shift
        AND CONVERT(DATETIME, @start_time, 120) >= start_time
        AND (end_time IS NULL OR CONVERT(DATETIME, @start_time, 120) <= end_time)
      ORDER BY start_time DESC
    `);

  if (result.recordset.length === 0) {
    throw new Error("Production run not found for the given time and line.");
  }

  return result.recordset[0].run_id;
}

async function resolveDowntimeMasterId(pool, order) {
  if (order.downtimemaster_id) {
    return order.downtimemaster_id;
  }

  const result = await pool
    .request()
    .input("line", sql.NVarChar, order.line)
    .input("category", sql.NVarChar, order.downtime_category)
    .input("downtime", sql.NVarChar, order.jenis)
    .query(`
      SELECT TOP 1 id
      FROM [dbo].[DowntimeMasterNew]
      WHERE line = @line
        AND downtime_category = @category
        AND downtime = @downtime
    `);

  if (result.recordset.length === 0) {
    throw new Error("Downtime master not found for the given selection.");
  }

  return result.recordset[0].id;
}

async function getRunIdByContext(plant, line, shift, startTime) {
  const pool = await getPool();
  const order = { plant, line, shift };
  return resolveRunId(pool, order, startTime);
}

async function createDowntime(order) {
  try {
    const pool = await getPool();
    const startTime = getStartTime(order);
    const durationMin = getDurationMin(order);

    if (!startTime || durationMin === null) {
      throw new Error("Start time and duration are required.");
    }

    const runId = await resolveRunId(pool, order, startTime);
    const downtimeMasterId = await resolveDowntimeMasterId(pool, order);

    const existingDowntime = await pool
      .request()
      .input("run_id", sql.BigInt, runId)
      .input("start_time", sql.VarChar, startTime)
      .input("duration_min", sql.Int, durationMin)
      .query(`
        SELECT TOP 1 event_id
        FROM [dbo].[DowntimeEvent]
        WHERE run_id = @run_id
          AND start_time < DATEADD(MINUTE, @duration_min, CONVERT(DATETIME, @start_time, 120))
          AND end_time > CONVERT(DATETIME, @start_time, 120)
      `);

    if (existingDowntime.recordset.length > 0) {
      throw new Error("Downtime conflicts with existing entries.");
    }

    const result = await pool
      .request()
      .input("run_id", sql.BigInt, runId)
      .input("downtimemaster_id", sql.Int, downtimeMasterId)
      .input("start_time", sql.VarChar, startTime)
      .input("duration_min", sql.Int, durationMin)
      .input("machine", sql.NVarChar, order.mesin ?? order.machine ?? null)
      .input("note", sql.NVarChar, order.keterangan ?? order.note ?? null)
      .query(`
        INSERT INTO [dbo].[DowntimeEvent] (
          run_id,
          downtimemaster_id,
          start_time,
          end_time,
          duration_min,
          machine,
          note
        ) OUTPUT inserted.event_id VALUES (
          @run_id,
          @downtimemaster_id,
          CONVERT(DATETIME, @start_time, 120),
          DATEADD(MINUTE, @duration_min, CONVERT(DATETIME, @start_time, 120)),
          @duration_min,
          @machine,
          @note
        );
      `);

    const newOrder = {
      ...order,
      id: result.recordset[0].event_id,
      run_id: runId,
      downtimemaster_id: downtimeMasterId,
    };
    console.log("New record created with id: ", newOrder.id);
    return newOrder;
  } catch (err) {
    console.error("Error creating downtime event:", err);
  }
}

async function updateDowntime(order) {
  try {
    const pool = await getPool();
    const startTime = getStartTime(order);
    const durationMin = getDurationMin(order);
    const eventId = order.id ?? order.event_id;

    if (!eventId) {
      throw new Error("Event id is required.");
    }

    if (!startTime || durationMin === null) {
      throw new Error("Start time and duration are required.");
    }

    const runId = await resolveRunId(pool, order, startTime);
    const downtimeMasterId = await resolveDowntimeMasterId(pool, order);

    // Cek konflik waktu (selain id yang sedang diupdate)
    const existingDowntime = await pool
      .request()
      .input("run_id", sql.BigInt, runId)
      .input("event_id", sql.BigInt, eventId)
      .input("start_time", sql.VarChar, startTime)
      .input("duration_min", sql.Int, durationMin)
      .query(`
        SELECT TOP 1 event_id
        FROM [dbo].[DowntimeEvent]
        WHERE run_id = @run_id
          AND event_id != @event_id
          AND start_time < DATEADD(MINUTE, @duration_min, CONVERT(DATETIME, @start_time, 120))
          AND end_time > CONVERT(DATETIME, @start_time, 120)
      `);

    if (existingDowntime.recordset.length > 0) {
      throw new Error("Downtime conflicts with existing entries.");
    }

    // Lakukan update
    const result = await pool
      .request()
      .input("event_id", sql.BigInt, eventId)
      .input("run_id", sql.BigInt, runId)
      .input("downtimemaster_id", sql.Int, downtimeMasterId)
      .input("start_time", sql.VarChar, startTime)
      .input("duration_min", sql.Int, durationMin)
      .input("machine", sql.NVarChar, order.mesin ?? order.machine ?? null)
      .input("note", sql.NVarChar, order.keterangan ?? order.note ?? null)
      .query(`
        UPDATE [dbo].[DowntimeEvent]
        SET
          run_id = @run_id,
          downtimemaster_id = @downtimemaster_id,
          start_time = CONVERT(DATETIME, @start_time, 120),
          end_time = DATEADD(MINUTE, @duration_min, CONVERT(DATETIME, @start_time, 120)),
          duration_min = @duration_min,
          machine = @machine,
          note = @note
        WHERE event_id = @event_id
      `);

    if (result.rowsAffected[0] === 0) {
      return null;
    }

    console.log("Record updated with id: ", eventId);
    return {
      ...order,
      id: eventId,
      run_id: runId,
      downtimemaster_id: downtimeMasterId,
    };
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
      .query(`
        SELECT
          e.event_id,
          e.start_time,
          e.end_time,
          e.duration_min,
          e.machine,
          e.note,
          pr.plant,
          pr.line,
          pr.shift,
          dm.downtime_category,
          dm.downtime
        FROM [dbo].[DowntimeEvent] e
        JOIN [dbo].[ProductionRun] pr ON pr.run_id = e.run_id
        LEFT JOIN [dbo].[DowntimeMasterNew] dm ON dm.id = e.downtimemaster_id
        ORDER BY e.start_time DESC
      `);

    const records = result.recordset;

    const grouped = {};

    records.forEach((item) => {
      const dateOnly = item.start_time.toISOString().split("T")[0]; // hanya ambil YYYY-MM-DD
      const key = `${item.plant}_${dateOnly}_${item.shift}_${item.line}`;

      if (!grouped[key]) {
        grouped[key] = {
          plant: item.plant,
          date: dateOnly,
          shift: item.shift,
          line: item.line,
          data: [],
        };
      }

      const endTime =
        item.end_time ??
        new Date(
          new Date(item.start_time).getTime() +
            parseInt(item.duration_min) * 60000
        );

      grouped[key].data.push({
        id: item.event_id,
        plant: item.plant,
        line: item.line,
        start_time: item.start_time,
        end_time: endTime,
        downtime_category: item.downtime_category,
        mesin: item.machine,
        jenis: item.downtime,
        keterangan: item.note,
        minutes: item.duration_min,
        completed: 0,
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
      .input("plant", sql.NVarChar, plant)
      .input("line", sql.NVarChar, line)
      .input("date", sql.VarChar, date) // format: 'YYYY-MM-DD'
      .input("shift", sql.NVarChar, shift)
      .query(`
        SELECT
          e.event_id AS id,
          pr.plant AS Plant,
          pr.line AS Line,
          e.start_time AS Date,
          pr.shift AS Shift,
          dm.downtime_category AS Downtime_Category,
          e.machine AS Mesin,
          dm.downtime AS Jenis,
          e.note AS Keterangan,
          e.duration_min AS Minutes,
          CAST(0 AS INT) AS Completed
        FROM [dbo].[DowntimeEvent] e
        JOIN [dbo].[ProductionRun] pr ON pr.run_id = e.run_id
        LEFT JOIN [dbo].[DowntimeMasterNew] dm ON dm.id = e.downtimemaster_id
        WHERE pr.plant = @plant
          AND pr.line = @line
          AND pr.shift = @shift
          AND CAST(e.start_time AS DATE) = CAST(@date AS DATE)
        ORDER BY e.start_time ASC
      `);

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
        DELETE FROM [dbo].[DowntimeEvent]
        WHERE event_id = @id
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
  getRunIdByContext,
  createDowntime,
  updateDowntime,
  getDowntimeOrder,
  getDowntimeData,
  deleteDowntime,
};
