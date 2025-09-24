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
    const posisi = req.query.posisi;

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
    const isDraft = req.body.isDraft || false; // Check if this is save as draft

    console.log("=== CREATE CIP REPORT START ===");
    console.log("Is Draft:", isDraft);
    console.log("Received data:", JSON.stringify(cipData, null, 2));

    // Validate required fields
    if (!cipData.processOrder || !cipData.plant || !cipData.line || !cipData.cipType) {
      console.error("Missing required fields");
      return res.status(400).json({
        message: "Missing required fields: processOrder, plant, line, cipType"
      });
    }

    // Additional validation for posisi and operator
    if (!cipData.operator) {
      console.error("Operator is required");
      return res.status(400).json({
        message: "Operator is required"
      });
    }

    if (!cipData.posisi) {
      console.error("Posisi is required");
      return res.status(400).json({
        message: "Posisi is required"
      });
    }

    // Check if this is a BCD line
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(cipData.line);

    // Line-specific validation - Only for critical fields that prevent saving
    if (isBCDLine) {
      // Validate based on specific line
      if (cipData.line === 'LINE D') {
        // Only validate flowRateD for LINE D
        if (!cipData.flowRateD) {
          console.error("Flow Rate D is required for LINE D");
          return res.status(400).json({
            message: "Flow Rate D is required for LINE D"
          });
        }
      } else if (cipData.line === 'LINE B' || cipData.line === 'LINE C') {
        // Only validate flowRateBC for LINE B/C
        if (!cipData.flowRateBC) {
          console.error("Flow Rate B,C is required for LINE B/C");
          return res.status(400).json({
            message: "Flow Rate B,C is required for LINE B/C"
          });
        }
      }

      // Validate valve positions
      if (!cipData.valvePositions) {
        console.error("Valve positions are required for BCD lines");
        return res.status(400).json({
          message: "Valve positions are required for BCD lines"
        });
      }
    } else {
      // Validate LINE A specific fields
      if (!cipData.flowRate) {
        console.error("Flow rate is required for LINE A");
        return res.status(400).json({
          message: "Flow rate is required"
        });
      }
    }

    // Set status based on isDraft flag
    let status = "In Progress"; // Default for draft
    if (!isDraft) {
      status = "Complete"; // Submitted/Finalized
    }

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

    // Validate data but don't block saving (warnings only)
    console.log("Validating CIP data for warnings...");
    const validationWarnings = validateCIPData(dataWithStatus);
    console.log("Validation warnings found:", validationWarnings.length);

    // Create the report with compliance calculation - ALWAYS SAVE
    console.log("Creating CIP report with compliance...");
    const result = await cipService.createCIPReportWithCompliance(dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      console.error("Failed to create CIP report - no result returned");
      return res.status(500).json({ message: "Failed to create CIP report" });
    }

    console.log("CIP report created successfully with ID:", result.cipReport.id);
    console.log("Status:", status);
    console.log("Compliance score:", result.complianceScore);
    console.log("=== CREATE CIP REPORT END ===");

    // Return success with warnings (not errors)
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
    console.error("=== CREATE CIP REPORT ERROR ===");
    console.error("Controller error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    console.error("=== END ERROR ===");

    // Return more detailed error in development
    const errorResponse = {
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        details: error.originalError ? error.originalError.message : undefined
      } : undefined
    };

    return res.status(500).json(errorResponse);
  }
};

exports.updateCIPReport = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const isDraft = req.body.isDraft || false;

    console.log("=== UPDATE CIP REPORT START ===");
    console.log("Report ID:", id);
    console.log("Is Draft:", isDraft);
    console.log("Update data:", JSON.stringify(updateData, null, 2));

    // Check if this is a BCD line update
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(updateData.line);

    // Get current report to check if it's already submitted
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
    let status = currentReport.status; // Keep current status by default
    if (isDraft && currentReport.status === 'In Progress') {
      status = "In Progress"; // Keep as draft
    } else if (!isDraft) {
      status = "Complete"; // Submit/Finalize
      updateData.submittedAt = new Date();
    }

    // Override status if explicitly provided
    if (updateData.status) {
      status = updateData.status;
    }

    // Add status to updateData
    const dataWithStatus = {
      ...updateData,
      status,
      isDraft
    };

    // Validate data but don't block updating (warnings only)
    if (updateData.steps || updateData.copRecords || updateData.specialRecords) {
      console.log("Validating updated data for warnings...");
      const validationWarnings = validateCIPData(dataWithStatus);
      console.log("Validation warnings found:", validationWarnings.length);
    }

    // Update the report with compliance calculation - ALWAYS UPDATE
    console.log("Updating CIP report with compliance...");
    const result = await cipService.updateCIPReportWithCompliance(id, dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      console.error("CIP report not found");
      return res.status(404).json({ message: "CIP report not found" });
    }

    console.log("CIP report updated successfully");
    console.log("Status:", status);
    console.log("Compliance score:", result.complianceScore);
    console.log("=== UPDATE CIP REPORT END ===");

    // Get validation warnings for response
    const validationWarnings = validateCIPData(dataWithStatus);

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
    console.error("=== UPDATE CIP REPORT ERROR ===");
    console.error("Controller error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    console.error("=== END ERROR ===");

    const errorResponse = {
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        details: error.originalError ? error.originalError.message : undefined
      } : undefined
    };

    return res.status(500).json(errorResponse);
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

// routes.js additions needed:
// PUT /cip-report/:id/submit - Submit a draft report
exports.submitCIPReport = async (req, res) => {
  try {
    const id = req.params.id;

    // Get current report
    const currentReport = await cipService.getCIPReportById(id);
    if (!currentReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    // Check if already submitted
    if (currentReport.status === 'Complete') {
      return res.status(400).json({ message: "Report is already submitted" });
    }

    // Update status to Complete
    const updateData = {
      status: "Complete",
      isDraft: false,
      submittedAt: new Date()
    };

    const result = await cipService.updateCIPReportWithCompliance(id, updateData, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    // Get validation warnings for response
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
    if (warning.message.includes("temperature")) {
      recommendations.push(`Temperature recommendation: ${warning.message}`);
    }
    if (warning.message.includes("concentration")) {
      recommendations.push(`Chemical concentration recommendation: ${warning.message}`);
    }
    if (warning.message.includes("Flow")) {
      recommendations.push(`Flow rate recommendation: ${warning.message}`);
    }
  });

  // Line-specific recommendations
  if (isBCDLine) {
    if (line === 'LINE D' && warnings.some(w => w.field === 'flowRateD')) {
      recommendations.push("Check Flow D pump and valves - recommended minimum 6000 L/H");
    }
    if ((line === 'LINE B' || line === 'LINE C') && warnings.some(w => w.field === 'flowRateBC')) {
      recommendations.push("Check Flow B,C pumps and valves - recommended minimum 9000 L/H");
    }
    if (warnings.some(w => w.message.includes("DRYING"))) {
      recommendations.push("DRYING process: Recommended temperature range 118-125°C");
    }
    if (warnings.some(w => w.message.includes("DISINFECT"))) {
      recommendations.push("DISINFECT process: Recommended chemical concentration (0.3-0.5%) and temperature settings");
    }
  }

  if (compliance.score === 100 && warnings.length === 0) {
    recommendations.push("Excellent: All parameters are within optimal ranges.");
  }

  return recommendations;
}

// New endpoint to get valve position configurations
exports.getValveConfigurations = async (req, res) => {
  try {
    const configurations = {
      "Final": {
        A: false,  // Close
        B: true,   // Open
        C: true    // Open
      },
      "Intermediate": {
        A: false,  // Close
        B: true,   // Open
        C: false   // Close
      }
    };

    return res.status(200).json(configurations);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// New endpoint to get flow rate requirements
exports.getFlowRateRequirements = async (req, res) => {
  try {
    const requirements = {
      "LINE A": {
        flowRate: { min: 0, description: "Standard flow rate" }
      },
      "LINE B": {
        flowBC: { min: 9000, unit: "L/H", description: "Flow B,C minimum" }
      },
      "LINE C": {
        flowBC: { min: 9000, unit: "L/H", description: "Flow B,C minimum" }
      },
      "LINE D": {
        flowD: { min: 6000, unit: "L/H", description: "Flow D minimum" }
      }
    };

    return res.status(200).json(requirements);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};