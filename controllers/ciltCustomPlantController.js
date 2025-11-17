const ciltCustomPlantService = require("../services/ciltCustomPlantService");

exports.getCustomPlant = async (req, res) => {
  try {
    const result = await ciltCustomPlantService.getCustomPlant();
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

exports.createCustomPlant = async (req, res) => {
  try {
    const result = await ciltCustomPlantService.createCustomPlant(req.body);
    return res.status(201).json({
      success: true,
      message: "Custom plant created successfully",
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

exports.updateCustomPlant = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomPlantService.updateCustomPlant(id, req.body);
    return res.status(200).json({
      success: true,
      message: "Custom plant updated successfully",
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

exports.deleteCustomPlant = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomPlantService.deleteCustomPlant(id);
    return res.status(200).json({
      success: true,
      message: "Custom plant deleted successfully",
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
