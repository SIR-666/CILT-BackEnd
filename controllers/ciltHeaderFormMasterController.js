const headerFormMasterService = require("../services/ciltHeaderFormMasterService");

const parseActiveOnly = (value) =>
  ["1", "true", "yes"].includes(String(value || "").trim().toLowerCase());

exports.getHeaderFormMasters = async (req, res) => {
  try {
    const result = await headerFormMasterService.listHeaderFormMasters({
      activeOnly: parseActiveOnly(req.query.activeOnly),
    });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Controller error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
      details: error.details,
    });
  }
};

exports.createHeaderFormMaster = async (req, res) => {
  try {
    const result = await headerFormMasterService.createHeaderFormMaster(req.body);
    return res.status(201).json({
      success: true,
      message: "Header Form Master created successfully",
      rowsAffected: result.rowsAffected,
      data: result.inserted[0] || null,
    });
  } catch (error) {
    console.error("Controller error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
      details: error.details,
    });
  }
};

exports.updateHeaderFormMaster = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await headerFormMasterService.updateHeaderFormMaster(id, req.body);
    return res.status(200).json({
      success: true,
      message: "Header Form Master updated successfully",
      rowsAffected: result.rowsAffected,
      data: result.updated[0] || null,
    });
  } catch (error) {
    console.error("Controller error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
      details: error.details,
    });
  }
};

exports.deleteHeaderFormMaster = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await headerFormMasterService.deleteHeaderFormMaster(id);
    return res.status(200).json({
      success: true,
      message: "Header Form Master deleted successfully",
      rowsAffected: result.rowsAffected,
      data: result.deleted[0] || null,
    });
  } catch (error) {
    console.error("Controller error:", error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: error.message || "Internal server error",
      details: error.details,
    });
  }
};
