const downtimeService = require("../services/downtimeService");

exports.getDowntimeList = async (req, res) => {
  try {
    const downtimeList = await downtimeService.getDowntimeList();

    if (!downtimeList) {
      return res.status(500).json({ message: "Failed to get downtime list" });
    }

    return res.status(200).json(downtimeList[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to get downtime list" });
  }
};

exports.getDowntimeMaster = async (req, res) => {
  try {
    const line = req.params.line;
    const category = req.params.category;

    const downtimeMaster = await downtimeService.getDowntimeMaster(
      line,
      category
    );

    if (!downtimeMaster) {
      return res.status(500).json({ message: "Failed to get downtime master" });
    }

    return res.status(200).json(downtimeMaster[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to get downtime master" });
  }
};

exports.getDowntimeMasterByLine = async (req, res) => {
  try {
    const line = req.query.line;

    const downtimeMaster = await downtimeService.getDowntimeMasterByLine(line);

    if (!downtimeMaster) {
      return res.status(500).json({ message: "Failed to get downtime master" });
    }

    return res.status(200).json(downtimeMaster[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to get downtime master" });
  }
};

exports.getChangeOverTargets = async (req, res) => {
  try {
    const line = req.query.line;

    if (!line) {
      return res.status(400).json({ message: "line is required" });
    }

    const targets = await downtimeService.getChangeOverTargets(line);
    return res.status(200).json(targets);
  } catch (error) {
    console.error(error);
    if (error.message?.includes("required")) {
      return res.status(400).json({ message: error.message });
    }
    return res
      .status(500)
      .json({ message: "Failed to get change over targets" });
  }
};

exports.resolveRunId = async (req, res) => {
  try {
    const { plant, line, shift, start_time: startTime } = req.query;

    if (!line || !startTime) {
      return res.status(400).json({ message: "line and start_time are required" });
    }

    const runId = await downtimeService.getRunIdByContext(
      plant,
      line,
      shift,
      startTime
    );

    return res.status(200).json({ run_id: runId });
  } catch (error) {
    console.error("Controller error:", error);
    if (error.message?.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message?.includes("required")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to resolve run id" });
  }
};

exports.createDowntime = async (req, res) => {
  try {
    const data = req.body;

    const newDowntime = await downtimeService.createDowntime(data);

    return res.status(201).json(newDowntime);
  } catch (error) {
    console.error("Controller error:", error);
    if (error.message?.includes("overlaps")) {
      return res.status(409).json({ message: error.message });
    }
    if (error.message?.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message?.includes("required")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateDowntime = async (req, res) => {
  try {
    const data = req.body;

    const updatedDowntime = await downtimeService.updateDowntime(data);
    if (!updatedDowntime) {
      return res.status(404).json({ message: "Downtime not found" });
    }

    return res.status(200).json(updatedDowntime);
  } catch (error) {
    console.error("Controller error:", error);
    if (error.message?.includes("overlaps")) {
      return res.status(409).json({ message: error.message });
    }
    if (error.message?.includes("not found")) {
      return res.status(404).json({ message: error.message });
    }
    if (error.message?.includes("required")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDowntimeOrder = async (req, res) => {
  try {
    const downtimeOrder = await downtimeService.getDowntimeOrder();

    if (!downtimeOrder) {
      return res.status(404).json({ message: "Downtime not found" });
    }

    return res.status(200).json(downtimeOrder);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getDowntimeData = async (req, res) => {
  try {
    const plant = req.query.plant;
    const line = req.query.line;
    const date = req.query.date;
    const shift = req.query.shift;

    const downtimeData = await downtimeService.getDowntimeData(
      plant,
      line,
      date,
      shift
    );

    if (!downtimeData) {
      return res.status(404).json({ message: "Downtime not found" });
    }

    return res.status(200).json(downtimeData[0]);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getProductionRunsByCombination = async (req, res) => {
  try {
    const { plant, line, date, shift } = req.query;

    if (!plant || !line || !date || !shift) {
      return res
        .status(400)
        .json({ message: "plant, line, date, and shift are required" });
    }

    const productionRuns = await downtimeService.getProductionRunsByCombination(
      plant,
      line,
      date,
      shift
    );

    return res.status(200).json(productionRuns || []);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteDowntime = async (req, res) => {
  try {
    const id = req.params.id;

    const deletedDowntime = await downtimeService.deleteDowntime(id);

    if (!deletedDowntime) {
      return res.status(404).json({ message: "Downtime not found" });
    }

    return res.status(200).json(deletedDowntime);
  } catch (error) {
    console.error("Controller error:", error);
    if (error.message?.includes("No record found")) {
      return res.status(404).json({ message: "Downtime not found" });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.reassignDowntimeRun = async (req, res) => {
  try {
    const { from_run_id: fromRunId, to_run_id: toRunId } = req.body;

    if (!fromRunId || !toRunId) {
      return res
        .status(400)
        .json({ message: "from_run_id and to_run_id are required" });
    }

    const result = await downtimeService.reassignDowntimeRun(fromRunId, toRunId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    if (error.message?.includes("required") || error.message?.includes("numeric")) {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Failed to reassign downtime runs" });
  }
};

exports.reassignDowntimeEvents = async (req, res) => {
  try {
    const { event_ids: eventIds, to_run_id: toRunId } = req.body;

    if (!Array.isArray(eventIds) || eventIds.length === 0 || !toRunId) {
      return res
        .status(400)
        .json({ message: "event_ids and to_run_id are required" });
    }

    const result = await downtimeService.reassignDowntimeEvents(eventIds, toRunId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    if (error.message?.includes("required") || error.message?.includes("numeric")) {
      return res.status(400).json({ message: error.message });
    }
    return res
      .status(500)
      .json({ message: "Failed to reassign downtime events" });
  }
};
