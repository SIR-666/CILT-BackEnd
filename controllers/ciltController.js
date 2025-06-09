const ciltService = require("../services/ciltService");

exports.createCILT = async (req, res) => {
  try {
    const order = req.body;

    const newOrder = await ciltService.createCILT(order);

    if (!newOrder) {
      return res.status(500).json({ message: "Failed to create CILT" });
    }

    return res.status(201).json(newOrder);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCILT = async (req, res) => {
  try {
    const id = req.params.id;
    const order = await ciltService.getCILT(id);

    if (!order) {
      return res.status(404).json({ message: "CILT record not found" });
    }

    return res.status(200).json(order);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllCILT = async (req, res) => {
  try {
    const status = req.query.status;
    const orders = await ciltService.getAllCILT(status);

    if (!orders) {
      return res.status(404).json({ message: "CILT records not found" });
    }

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateCILT = async (req, res) => {
  try {
    const id = req.params.id;
    const order = req.body;

    const updatedOrder = await ciltService.updateCILT(id, order);

    if (!updatedOrder) {
      return res.status(404).json({ message: "CILT record not found" });
    }

    return res.status(200).json(updatedOrder);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteCILT = async (req, res) => {
  try {
    const id = req.params.id;

    const deletedOrder = await ciltService.deleteCILT(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: "CILT record not found" });
    }

    return res.status(200).json(deletedOrder);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getSku = async (req, res) => {
  try {
    const plant = req.query.plant;
    const sku = await ciltService.getSKU(plant);

    if (!sku) {
      return res.status(404).json({ message: "SKU not found" });
    }

    return res.status(200).json(sku[0]);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.checkDraft = async (req, res) => {
  try {
    const status = req.query.status;
    const orders = await ciltService.checkDraft(status);

    if (!orders) {
      return res.status(404).json({ message: "CILT records not found" });
    }

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReportCILTAll = async (req, res) => {
  try {
    const packageType = req.params.packageType;
    const plant = req.params.plant;
    const line = req.params.line;
    const shift = req.params.shift;
    const machine = req.params.machine;
    const date = req.params.date;

    const orders = await ciltService.getReportCILTAll(
      packageType,
      plant,
      line,
      shift,
      machine,
      date
    );

    if (!orders) {
      return res.status(404).json({ message: "CILT records not found" });
    }

    return res.status(200).json(orders);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
