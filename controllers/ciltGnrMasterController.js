const masterGnrService = require("../services/ciltGnrMasterService");

exports.getAllMasterGNR = async (req, res) => {
  try {
    const plant = req.query.plant;
    const line = req.query.line;
    const machine = req.query.machine;
    const type = req.query.type;
    const masterCILT = await masterGnrService.getAllMasterGNR(
      plant,
      line,
      machine,
      type
    );

    if (!masterCILT) {
      return res.status(404).json({ message: "Master GNR not found" });
    }

    return res.status(200).json(masterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.createGNR = async (req, res) => {
  try {
    const data = req.body;
    const result = await masterGnrService.createGNR(data);
    return res.status(201).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateGNR = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const result = await masterGnrService.updateGNR(id, data);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.disabledGNR = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await masterGnrService.disabledGNR(id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.enabledGNR = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await masterGnrService.enabledGNR(id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
