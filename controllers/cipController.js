const cipService = require("../services/cipService");
const cipTemplateService = require("../services/cipTemplateService");
const { validateCIPData, calculateComplianceScore } = require("../services/cipValidationService");

exports.getAllCIPReports = async (req, res) => {
  try {
    const { date, plant, line, processOrder, status, cipType, posisi } = req.query;

    const cipReports = await cipService.getAllCIPReports(
      date, plant, line, processOrder, status, cipType, posisi
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
    const isDraft = req.body.isDraft !== false; // Default to draft if not specified

    console.log("Is Draft:", isDraft);

    // LESS STRICT VALIDATION - Only `line` is required
    if (!cipData.line) {
      console.error("Missing required field: line");
      return res.status(400).json({
        message: "Missing required field: line"
      });
    }

    // Auto-generate processOrder if not provided
    if (!cipData.processOrder) {
      cipData.processOrder = `CIP-${Date.now()}`;
      console.log("Auto-generated processOrder:", cipData.processOrder);
    }

    // Auto-fill operator from authenticated user if available
    if (!cipData.operator && req.user) {
      cipData.operator = req.user.username || req.user.name;
    }

    // Auto-fill createdBy
    cipData.createdBy = cipData.operator || (req.user ? req.user.username : null);

    // Set default plant if not provided
    if (!cipData.plant) {
      cipData.plant = "Milk Filling Packing";
    }

    // Set status based on isDraft flag
    let status = isDraft ? "In Progress" : "Complete";

    // Override status if explicitly provided
    if (cipData.status) {
      status = cipData.status;
    }

    // Add status to cipData
    const dataWithStatus = {
      ...cipData,
      status,
      isDraft,
      submittedAt: !isDraft ? new Date() : null
    };

    // Validate data - collect warnings but DON'T block saving
    console.log("Validating CIP data for warnings...");
    const validationWarnings = validateCIPData(dataWithStatus);
    console.log("Validation warnings found:", validationWarnings.length);

    // Create the report - ALWAYS SAVE regardless of warnings
    console.log("Creating CIP report...");
    const result = await cipService.createCIPReportWithCompliance(dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      console.error("Failed to create CIP report - no result returned");
      return res.status(500).json({ message: "Failed to create CIP report" });
    }

    console.log("CIP report created successfully with ID:", result.cipReport.id);

    return res.status(201).json({
      message: isDraft
        ? "CIP report saved as draft successfully"
        : "CIP report submitted successfully",
      data: result.cipReport,
      compliance: result.complianceScore,
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      hasValidationWarnings: validationWarnings.length > 0,
      isDraft,
      status
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.updateCIPReport = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const isDraft = req.body.isDraft !== false;

    console.log("Report ID:", id);
    console.log("Is Draft:", isDraft);

    // Get current report
    const currentReport = await cipService.getCIPReportById(id);
    if (!currentReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    // Prevent editing if already submitted (unless explicitly allowed)
    if (currentReport.status === 'Complete' && !req.body.allowEditSubmitted) {
      return res.status(400).json({
        message: "Cannot edit submitted report. Contact admin if changes are needed."
      });
    }

    // Set status based on isDraft flag
    let status = currentReport.status;
    if (isDraft) {
      status = "In Progress";
    } else if (!isDraft && currentReport.status === 'In Progress') {
      status = "Complete";
    }

    const dataWithStatus = {
      ...updateData,
      status,
      isDraft,
      submittedAt: !isDraft ? new Date() : null
    };

    // Validate data - collect warnings but DON'T block saving
    const validationWarnings = validateCIPData(dataWithStatus);

    // Update the report - ALWAYS SAVE regardless of warnings
    const result = await cipService.updateCIPReportWithCompliance(id, dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    console.log("CIP report updated successfully");

    return res.status(200).json({
      message: isDraft
        ? "CIP report saved as draft successfully"
        : "CIP report submitted successfully",
      data: result.cipReport,
      compliance: result.complianceScore,
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      hasValidationWarnings: validationWarnings.length > 0,
      isDraft,
      status
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

    return res.status(200).json({ message: "CIP report deleted successfully" });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.submitCIPReport = async (req, res) => {
  try {
    const id = req.params.id;

    const currentReport = await cipService.getCIPReportById(id);
    if (!currentReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    if (currentReport.status === 'Complete') {
      return res.status(400).json({ message: "Report is already submitted" });
    }

    const updateData = {
      ...currentReport,
      status: "Complete",
      isDraft: false,
      submittedAt: new Date()
    };

    const result = await cipService.updateCIPReportWithCompliance(id, updateData, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    const validationWarnings = validateCIPData(result.cipReport);

    return res.status(200).json({
      message: "CIP report submitted successfully",
      data: result.cipReport,
      compliance: result.complianceScore,
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      hasValidationWarnings: validationWarnings.length > 0
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.approveCIPReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, userName } = req.body;
    const now = new Date();

    const result = await cipService.updateApprovalStatus(id, roleId, "approve", userName, now);

    res.status(200).json({ message: "Report approved successfully", result });
  } catch (error) {
    console.error("Error approving report:", error);
    res.status(500).json({ message: "Failed to approve report" });
  }
};

exports.rejectCIPReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, userName } = req.body;
    const now = new Date();

    const result = await cipService.updateApprovalStatus(id, roleId, "reject", userName, now);

    res.status(200).json({ message: "Report rejected successfully", result });
  } catch (error) {
    console.error("Error rejecting report:", error);
    res.status(500).json({ message: "Failed to reject report" });
  }
};

// STATIC DATA ENDPOINTS
exports.getCIPTypes = async (req, res) => {
  try {
    const cipTypes = [
      { id: 1, name: "CIP KITCHEN 1", value: "CIP_KITCHEN_1", description: "CIP Kitchen Type 1 cleaning process" },
      { id: 2, name: "CIP KITCHEN 2", value: "CIP_KITCHEN_2", description: "CIP Kitchen Type 2 cleaning process" },
      { id: 3, name: "CIP KITCHEN 3", value: "CIP_KITCHEN_3", description: "CIP Kitchen Type 3 cleaning process" },
    ];

    return res.status(200).json(cipTypes);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCIPStatusList = async (req, res) => {
  try {
    const statusList = [
      { id: 1, name: "In Progress", color: "#FF9800", description: "Draft - not yet submitted" },
      { id: 2, name: "Complete", color: "#4CAF50", description: "Submitted and finalized" },
      { id: 3, name: "Under Review", color: "#2196F3", description: "Being reviewed by supervisor" },
      { id: 4, name: "Approved", color: "#4CAF50", description: "Approved by supervisor" },
      { id: 5, name: "Rejected", color: "#F44336", description: "Rejected - needs revision" },
      { id: 6, name: "Cancelled", color: "#757575", description: "Cancelled report" }
    ];
    return res.status(200).json(statusList);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// TEMPLATE ENDPOINTS (using cipTemplateService)

/**
 * Get CIP Step Templates
 * GET /cip-report/templates/steps?line=LINE A&posisi=Final
 */
exports.getCIPStepTemplates = async (req, res) => {
  try {
    const { line, posisi } = req.query;

    console.log(`[getCIPStepTemplates] Fetching templates for line: ${line}, posisi: ${posisi}`);

    if (line) {
      // Get template for specific line
      const template = await cipTemplateService.getTemplateByLine(line, posisi || "Final");

      console.log(`[getCIPStepTemplates] Template fetched:`, {
        cipStepsCount: template.cipSteps?.length || 0,
        specialRecordsCount: template.specialRecords?.length || 0,
        flowRate: template.flowRate,
        valveConfigCount: template.valveConfig?.length || 0,
      });

      // Return in format expected by frontend
      return res.status(200).json({
        success: true,
        data: {
          cipSteps: template.cipSteps,
          specialRecords: template.specialRecords,
          flowRate: template.flowRate,
          valveConfig: template.valveConfig,
        },
        message: "Templates fetched successfully"
      });
    }

    // Return default steps if no line specified
    const steps = await cipTemplateService.getCipSteps();
    return res.status(200).json({
      success: true,
      data: {
        cipSteps: steps
      },
      message: "Default CIP steps fetched"
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Get Valve Configurations
 * GET /cip-report/valve-configurations?posisi=Final
 */
exports.getValveConfigurations = async (req, res) => {
  try {
    const { posisi } = req.query;

    if (posisi) {
      // Get specific posisi config
      const config = await cipTemplateService.getValveConfig(posisi);
      return res.status(200).json({
        success: true,
        data: config,
        posisi
      });
    }

    // Return both configurations
    const [finalConfig, intermediateConfig] = await Promise.all([
      cipTemplateService.getValveConfig("Final"),
      cipTemplateService.getValveConfig("Intermediate")
    ]);

    return res.status(200).json({
      success: true,
      data: {
        Final: finalConfig,
        Intermediate: intermediateConfig
      }
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Get Flow Rate Requirements
 * GET /cip-report/flow-requirements?line=LINE A
 */
exports.getFlowRateRequirements = async (req, res) => {
  try {
    const { line } = req.query;

    if (line) {
      // Get specific line flow rate
      const flowRate = await cipTemplateService.getFlowRate(line);
      return res.status(200).json({
        success: true,
        data: flowRate,
        line
      });
    }

    // Return all flow rates from database
    const [lineA, lineB, lineC, lineD] = await Promise.all([
      cipTemplateService.getFlowRate("LINE A"),
      cipTemplateService.getFlowRate("LINE B"),
      cipTemplateService.getFlowRate("LINE C"),
      cipTemplateService.getFlowRate("LINE D"),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        "LINE A": lineA,
        "LINE B": lineB,
        "LINE C": lineC,
        "LINE D": lineD,
      }
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// COMPLIANCE CHECK
exports.checkCIPCompliance = async (req, res) => {
  try {
    const id = req.params.id;
    const cipReport = await cipService.getCIPReportById(id);

    if (!cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    const complianceScore = calculateComplianceScore(cipReport);
    const validationWarnings = validateCIPData(cipReport);

    return res.status(200).json({
      reportId: id,
      compliance: complianceScore,
      validationWarnings: validationWarnings,
      recommendations: generateRecommendations(validationWarnings, complianceScore, cipReport.line)
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to generate recommendations
function generateRecommendations(warnings, compliance, line) {
  const recommendations = [];
  const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(line);

  if (compliance.failedChecks > 0) {
    recommendations.push("Warning: Some parameters are outside acceptable ranges. Please review and adjust if needed.");
  }

  if (compliance.warnings > 0) {
    recommendations.push("Notice: Some parameters are near the boundary limits. Monitor closely.");
  }

  warnings.forEach(warning => {
    if (warning.message.includes("temperature") || warning.message.includes("Temperature")) {
      recommendations.push(`Temperature: ${warning.message}`);
    }
    if (warning.message.includes("concentration") || warning.message.includes("Concentration")) {
      recommendations.push(`Concentration: ${warning.message}`);
    }
    if (warning.message.includes("Flow")) {
      recommendations.push(`Flow rate: ${warning.message}`);
    }
  });

  // Line-specific recommendations
  if (line === 'LINE A' && warnings.some(w => w.field === 'flowRate')) {
    recommendations.push("Check Flow A pump and valves - recommended minimum 12000 L/H");
  }

  if (isBCDLine) {
    if (line === 'LINE D' && warnings.some(w => w.field === 'flowRateD')) {
      recommendations.push("Check Flow D pump and valves - recommended minimum 6000 L/H");
    }
    if ((line === 'LINE B' || line === 'LINE C') && warnings.some(w => w.field === 'flowRateBC')) {
      recommendations.push("Check Flow B,C pumps and valves - recommended minimum 9000 L/H");
    }
  }

  if (compliance.score === 100 && warnings.length === 0) {
    recommendations.push("Excellent: All parameters are within optimal ranges.");
  }

  return recommendations;
}