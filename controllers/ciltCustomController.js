const ciltCustomService = require("../services/ciltCustomService");

exports.getCustomData = async (req, res) => {
  try {
    const result = await ciltCustomService.getCustomData();
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

exports.createCustomData = async (req, res) => {
  try {
    const result = await ciltCustomService.createCustomData(req.body);
    return res.status(201).json({
      success: true,
      message: "Custom data created successfully",
      rowsAffected: result.rowsAffected,
      data: result.inserted,
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

exports.updateCustomData = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.updateCustomData(id, req.body);
    return res.status(200).json({
      success: true,
      message: "Custom data updated successfully",
      rowsAffected: result.rowsAffected,
      data: result.updated,
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

exports.deleteCustomData = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.deleteCustomData(id);
    return res.status(200).json({
      success: true,
      message: "Custom data deleted successfully",
      rowsAffected: result.rowsAffected,
      data: result.deleted,
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

