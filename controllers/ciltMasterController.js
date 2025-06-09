const ciltMasterService = require("../services/ciltMasterService");

exports.createMasterCILT = async (req, res) => {
  try {
    const data = req.body;

    const newMasterCILT = await ciltMasterService.createMasterCILT(data);

    if (!newMasterCILT) {
      return res.status(500).json({ message: "Failed to create master CILT" });
    }

    return res.status(201).json(newMasterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMasterCILT = async (req, res) => {
  try {
    const id = req.params.id;
    const masterCILT = await ciltMasterService.getMasterCILT(id);

    if (!masterCILT) {
      return res.status(404).json({ message: "Master CILT not found" });
    }

    return res.status(200).json(masterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllMasterCILT = async (req, res) => {
  try {
    const plant = req.query.plant;
    const line = req.query.line;
    const machine = req.query.machine;
    const type = req.query.type;
    const masterCILT = await ciltMasterService.getAllMasterCILT(
      plant,
      line,
      machine,
      type
    );

    if (!masterCILT) {
      return res.status(404).json({ message: "Master CILT not found" });
    }

    return res.status(200).json(masterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPlant = async (req, res) => {
  try {
    const plant = await ciltMasterService.getPlant();

    if (!plant) {
      return res.status(404).json({ message: "Plant not found" });
    }

    return res.status(200).json(plant);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getLine = async (req, res) => {
  try {
    const line = await ciltMasterService.getLine(req.query.plant);

    if (!line) {
      return res.status(404).json({ message: "Line not found" });
    }

    return res.status(200).json(line);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMachine = async (req, res) => {
  try {
    const machine = await ciltMasterService.getMachine(
      req.query.plant,
      req.query.line
    );

    if (!machine) {
      return res.status(404).json({ message: "Machine not found" });
    }

    return res.status(200).json(machine);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getType = async (req, res) => {
  try {
    const type = await ciltMasterService.getType(
      req.query.plant,
      req.query.line,
      req.query.machine
    );

    if (!type) {
      return res.status(404).json({ message: "Type not found" });
    }

    return res.status(200).json(type);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateMasterCILT = async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const updatedMasterCILT = await ciltMasterService.updateMasterCILT(
      id,
      data
    );

    if (!updatedMasterCILT) {
      return res.status(404).json({ message: "Master CILT not found" });
    }

    return res.status(200).json(updatedMasterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteMasterCILT = async (req, res) => {
  try {
    const id = req.params.id;

    const deletedMasterCILT = await ciltMasterService.deleteMasterCILT(id);

    if (!deletedMasterCILT) {
      return res.status(404).json({ message: "Master CILT not found" });
    }

    return res.status(200).json(deletedMasterCILT);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
