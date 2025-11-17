const ciltCustomMachineService = require("../services/ciltCustomMachineService");

exports.getCustomMachine = async (req, res) => {
  try {
    const result = await ciltCustomMachineService.getCustomMachine();
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

exports.createCustomMachine = async (req, res) => {
  try {
    const result = await ciltCustomMachineService.createCustomMachine(req.body);
    return res.status(201).json({
      success: true,
      message: "Custom machine created successfully",
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

exports.updateCustomMachine = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomMachineService.updateCustomMachine(
      id,
      req.body
    );
    return res.status(200).json({
      success: true,
      message: "Custom machine updated successfully",
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

exports.deleteCustomMachine = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomMachineService.deleteCustomMachine(id);
    return res.status(200).json({
      success: true,
      message: "Custom machine deleted successfully",
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
