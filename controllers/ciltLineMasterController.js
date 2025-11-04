const ciltLineMasterService = require("../services/ciltLineService");

exports.createFrom = async (req, res) => {
  try {
    const result = await ciltLineMasterService.createFrom(req.body);
    return res.status(201).json({
      success: true,
      message: "Packages created from reference",
      rowsAffected: result.rowsAffected,
      data: result.inserted,
      gnr: result.gnr,
      checklist: result.checklist,
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

exports.deleteLine = async (req, res) => {
  try {
    const line = decodeURIComponent(req.params.line || "").trim();
    if (!line) {
      return res
        .status(400)
        .json({ success: false, message: "parameter line wajib diisi" });
    }

    const result = await ciltLineMasterService.deleteLine(line);
    return res.status(200).json({
      success: true,
      message: `Deleted data by line: ${line}`,
      ...result, // { line, totalDeleted, package, gnr, checklist }
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
