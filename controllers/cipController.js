const cipService = require("../services/cipService");
const { validateCIPData, calculateComplianceScore } = require("../services/cipValidationService");

exports.getAllCIPReports = async (req, res) => {
  try {
    const date = req.query.date;
    const plant = req.query.plant;
    const line = req.query.line;
    const processOrder = req.query.processOrder;
    const status = req.query.status;
    const cipType = req.query.cipType;
    const posisi = req.query.posisi; // Added posisi filter

    const cipReports = await cipService.getAllCIPReports(
      date,
      plant,
      line,
      processOrder,
      status,
      cipType,
      posisi
    );

    if (!cipReports) {
      return res.status(404).json({ message: "CIP reports not found" });
    }

    return res.status(200).json(cipReports);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCIPReportById = async (req, res) => {
  try {
    const id = req.params.id;
    const cipReport = await cipService.getCIPReportById(id);

    if (!cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    return res.status(200).json(cipReport);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.createCIPReport = async (req, res) => {
  try {
    const cipData = req.body;

    // Validate required fields
    if (!cipData.processOrder || !cipData.plant || !cipData.line || !cipData.cipType) {
      return res.status(400).json({ 
        message: "Missing required fields: processOrder, plant, line, cipType" 
      });
    }

    // Additional validation for posisi and operator
    if (!cipData.operator) {
      return res.status(400).json({ 
        message: "Operator is required" 
      });
    }

    if (!cipData.posisi) {
      return res.status(400).json({ 
        message: "Posisi is required" 
      });
    }

    // Validate temperature and concentration ranges
    const validationErrors = validateCIPData(cipData);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors
      });
    }

    const newCIPReport = await cipService.createCIPReport(cipData);

    if (!newCIPReport) {
      return res.status(500).json({ message: "Failed to create CIP report" });
    }

    // Calculate compliance score
    const complianceScore = calculateComplianceScore(newCIPReport);

    return res.status(201).json({
      message: "CIP report created successfully",
      data: newCIPReport,
      compliance: complianceScore
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateCIPReport = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;

    // Validate temperature and concentration ranges if steps or copRecords are being updated
    if (updateData.steps || updateData.copRecords) {
      const validationErrors = validateCIPData(updateData);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationErrors
        });
      }
    }

    const updatedCIPReport = await cipService.updateCIPReport(id, updateData);

    if (!updatedCIPReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    // Calculate compliance score
    const complianceScore = calculateComplianceScore(updatedCIPReport);

    return res.status(200).json({
      message: "CIP report updated successfully",
      data: updatedCIPReport,
      compliance: complianceScore
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.deleteCIPReport = async (req, res) => {
  try {
    const id = req.params.id;
    
    const deleted = await cipService.deleteCIPReport(id);

    if (!deleted) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    return res.status(200).json({
      message: "CIP report deleted successfully"
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCIPTypes = async (req, res) => {
  try {
    const cipTypes = await cipService.getCIPTypes();
    return res.status(200).json(cipTypes);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCIPStatusList = async (req, res) => {
  try {
    const statusList = await cipService.getCIPStatusList();
    return res.status(200).json(statusList);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCIPStepTemplates = async (req, res) => {
  try {
    const templates = await cipService.getCIPStepTemplates();
    return res.status(200).json(templates);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// New endpoint for compliance check
exports.checkCIPCompliance = async (req, res) => {
  try {
    const id = req.params.id;
    const cipReport = await cipService.getCIPReportById(id);

    if (!cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    const complianceScore = calculateComplianceScore(cipReport);
    const validationErrors = validateCIPData(cipReport);

    return res.status(200).json({
      reportId: id,
      compliance: complianceScore,
      validationErrors: validationErrors,
      recommendations: generateRecommendations(validationErrors, complianceScore)
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to generate recommendations
function generateRecommendations(errors, compliance) {
  const recommendations = [];

  if (compliance.failedChecks > 0) {
    recommendations.push("Critical: Some parameters are outside acceptable ranges. Immediate action required.");
  }

  if (compliance.warnings > 0) {
    recommendations.push("Warning: Some parameters are near the boundary limits. Monitor closely.");
  }

  errors.forEach(error => {
    if (error.message.includes("temperature")) {
      recommendations.push(`Temperature adjustment needed: ${error.message}`);
    }
    if (error.message.includes("concentration")) {
      recommendations.push(`Chemical concentration adjustment needed: ${error.message}`);
    }
  });

  if (compliance.score === 100) {
    recommendations.push("Excellent: All parameters are within optimal ranges.");
  }

  return recommendations;
}