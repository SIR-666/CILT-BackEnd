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
      message: `Custom data deleted successfully (Metadata: ${result.rowsAffected}, Designer: ${result.packageRowsAffected || 0})`,
      rowsAffected: result.rowsAffected,
      packageRowsAffected: result.packageRowsAffected,
      data: result.deleted,
      packageDeleted: result.packageDeleted,
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

exports.updatePackageWithRelations = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.updatePackageWithRelations(id, req.body);
    return res.status(200).json({
      success: true,
      message: "Package updated successfully",
      rowsAffected: result.rowsAffected,
      data: result.updated,
    });
  } catch (error) {
    console.error("Controller error:", error);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

exports.getCustomDataById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.getCustomDataById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

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

exports.getCustomDataWithParsed = async (req, res) => {
  try {
    const result = await ciltCustomService.getCustomDataWithParsed();
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

exports.getCustomPackages = async (req, res) => {
  try {
    const result = await ciltCustomService.getCustomPackages();
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.getCustomPackageById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.getCustomPackageById(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...result,

        header: typeof result.header === "string"
          ? result.header
          : JSON.stringify(result.headerParsed || {}),

        item: typeof result.item === "string"
          ? result.item
          : JSON.stringify(result.itemParsed || []),

        headerParsed: result.headerParsed,
        itemParsed: result.itemParsed,
      },
    });

  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createCustomPackage = async (req, res) => {
  try {
    const result = await ciltCustomService.createCustomPackage(req.body);
    return res.status(201).json({
      success: true,
      message: "Package designer created successfully",
      rowsAffected: result.rowsAffected,
      data: result.inserted,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateCustomPackage = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.updateCustomPackage(id, req.body);
    return res.status(200).json({
      success: true,
      message: "Package designer updated successfully",
      rowsAffected: result.rowsAffected,
      data: result.updated,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteCustomPackage = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await ciltCustomService.deleteCustomPackage(id);
    return res.status(200).json({
      success: true,
      message: `Package deleted from both tables (Designer: ${result.rowsAffected}, Metadata: ${result.metadataRowsAffected || 0})`,
      rowsAffected: result.rowsAffected,
      metadataRowsAffected: result.metadataRowsAffected,
      data: result.deleted,
      metadataDeleted: result.metadataDeleted,
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};