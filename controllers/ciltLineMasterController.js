ciltLineMasterService = require("../services/ciltLineService");

exports.createFrom = async (req, res) => {
  try {
    const { lineName, lineReference } = req.body;
    const createdCount = await ciltLineMasterService.createFrom(lineName, lineReference);
    return res.status(201).json({ rowsAffected: createdCount });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}