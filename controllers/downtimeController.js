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
    const mesin = req.params.mesin;

    const downtimeMaster = await downtimeService.getDowntimeMaster(
      line,
      category,
      mesin
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

exports.createDowntime = async (req, res) => {
  try {
    const data = req.body;

    const newDowntime = await downtimeService.createDowntime(data);

    if (!newDowntime) {
      return res
        .status(400)
        .json({ message: "Downtime conflicts with existing entries" });
    }

    return res.status(201).json(newDowntime);
  } catch (error) {
    console.error("Controller error:", error);
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
