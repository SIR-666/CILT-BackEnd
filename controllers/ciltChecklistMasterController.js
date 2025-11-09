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

exports.createChecklist = async (req, res) => {
  try {
    const result = await masterChecklistService.createChecklist(req.body);
    return res.status(201).json({
      success: true,
      message: "Checklist created",
      data: result.inserted,
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateChecklist = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await masterChecklistService.updateChecklist(id, req.body);
    return res.status(200).json({
      success: true,
      message: "Checklist updated",
      data: result.updated,
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.disableChecklist = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await masterChecklistService.disableChecklist(id, 0);
    return res.status(200).json({
      success: true,
      message: "Checklist disabled",
      data: result.updated,
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.enableChecklist = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await masterChecklistService.enableChecklist(id, 1);
    return res.status(200).json({
      success: true,
      message: "Checklist enabled",
      data: result.updated,
      rowsAffected: result.rowsAffected,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
