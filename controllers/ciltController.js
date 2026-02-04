const ciltService = require("../services/ciltService");

exports.createCILT = async (req, res) => {
  try {
    const order = req.body;
    const newOrder = await ciltService.createCILT(order);
    if (!newOrder) return res.status(500).json({ message: "Failed to create CILT" });
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
    if (!order) return res.status(404).json({ message: "CILT record not found" });
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
    if (!orders) return res.status(404).json({ message: "CILT records not found" });
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
    const updated = await ciltService.updateCILT(id, order);
    if (!updated) return res.status(404).json({ message: "CILT record not found" });
    return res.status(200).json({ rowsAffected: updated });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteCILT = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await ciltService.deleteCILT(id);
    if (!deleted) return res.status(404).json({ message: "CILT record not found" });
    return res.status(200).json({ rowsAffected: deleted });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getSku = async (req, res) => {
  try {
    const sku = await ciltService.getSKU();
    if (!sku || sku.length === 0) return res.status(404).json({ message: "SKU not found" });
    return res.status(200).json(sku);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getSkuBySku = async (req, res) => {
  try {
    const sku = req.query.sku;
    const skuData = await ciltService.getSKU(sku);
    if (!skuData || skuData.length === 0) return res.status(404).json({ message: "SKU not found" });
    return res.status(200).json(skuData[0]);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.checkDraft = async (req, res) => {
  try {
    const status = req.query.status;
    const orders = await ciltService.checkDraft(status);
    if (!orders) return res.status(404).json({ message: "CILT records not found" });
    return res.status(200).json(orders);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getReportCILTAll = async (req, res) => {
  try {
    const { packageType, plant, line, shift, machine, date } = req.params;
    const orders = await ciltService.getReportCILTAll(
      packageType, plant, line, shift, machine, date
    );
    if (!orders) return res.status(404).json({ message: "CILT records not found" });
    return res.status(200).json(orders);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCILTByProcessOrder = async (req, res) => {
  try {
    const processOrder = req.query.processOrder;
    const order = await ciltService.checkCiltByProcessOrder(processOrder);
    if (!order) return res.status(404).json({ message: "CILT record not found" });
    return res.status(200).json(order);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.approveByCoor = async (req, res) => {
  try {
    const id = req.params.id;
    const { username, role } = req.body;
    if (parseInt(role) !== 11) {
      return res.status(403).json({ message: "Unauthorized: Only Coordinator can approve" });
    }
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
    const result = await ciltService.approveByCoor(id, username);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

exports.approveBySpv = async (req, res) => {
  try {
    const id = req.params.id;
    const { username, role } = req.body;
    if (parseInt(role) !== 9) {
      return res.status(403).json({ message: "Unauthorized: Only Supervisor can approve" });
    }
    if (!username) {
      return res.status(400).json({ message: "Username is required" });
    }
    const result = await ciltService.approveBySpv(id, username);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

exports.getAllCILTWithFilters = async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      approval_coor: req.query.approval_coor, // (diabaikan di service)
      approval_spv: req.query.approval_spv,   // (diabaikan di service)
      plant: req.query.plant,
      line: req.query.line,
      shift: req.query.shift,
      date: req.query.date,
    };

    const orders = await ciltService.getAllCILTWithFilters(filters);
    return res.status(200).json(orders || []);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

exports.getApprovalStatus = async (req, res) => {
  try {
    const id = req.params.id;
    const status = await ciltService.getApprovalStatus(id);
    if (!status) return res.status(404).json({ message: "CILT record not found" });
    return res.status(200).json(status);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ===== Master endpoints =====
exports.getMasterPlant = async (_req, res) => {
  try {
    const rows = await ciltService.getMasterPlant();
    return res.status(200).json(rows || []);
  } catch (e) {
    console.error("getMasterPlant error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMasterLine = async (_req, res) => {
  try {
    const rows = await ciltService.getMasterLine();
    return res.status(200).json(rows || []);
  } catch (e) {
    console.error("getMasterLine error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getMasterPackage = async (_req, res) => {
  try {
    const rows = await ciltService.getMasterPackage();
    return res.status(200).json(rows || []);
  } catch (e) {
    console.error("getMasterPackage error:", e);
    return res.status(500).json({ message: "Internal server error" });
  }
};
