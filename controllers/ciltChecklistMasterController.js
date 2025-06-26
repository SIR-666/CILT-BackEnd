const masterChecklistService = require("../services/ciltChecklistMasterService");

exports.getAllMasterChecklist = async (req, res) => {
  try {
    const plant = req.query.plant;
    const line = req.query.line;
    const machine = req.query.machine;
    const type = req.query.type;
    const masterCILT = await masterChecklistService.getAllMasterChecklist(
      plant,
      line,
      machine,
      type
    );

    if (!masterCILT) {
      return res.status(404).json({ message: "Master checklist not found" });
    }

    return res.status(200).json(masterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
