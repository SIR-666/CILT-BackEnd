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

    console.log("=== CREATE CIP REPORT START ===");
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

    // Line-specific validation
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

        if (parseFloat(cipData.flowRateD) < 6000) {
          return res.status(400).json({ 
            message: "Flow Rate D must be minimum 6000 L/H" 
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

        if (parseFloat(cipData.flowRateBC) < 9000) {
          return res.status(400).json({ 
            message: "Flow Rate B,C must be minimum 9000 L/H" 
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

    // Validate temperature and concentration ranges
    console.log("Validating CIP data...");
    const validationErrors = validateCIPData(cipData);
    if (validationErrors.length > 0) {
      console.error("Validation errors:", validationErrors);
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors
      });
    }
    console.log("Validation passed");

    // Create the report with compliance calculation
    console.log("Creating CIP report with compliance...");
    const result = await cipService.createCIPReportWithCompliance(cipData, calculateComplianceScore);

    if (!result || !result.cipReport) {
      console.error("Failed to create CIP report - no result returned");
      return res.status(500).json({ message: "Failed to create CIP report" });
    }

    console.log("CIP report created successfully with ID:", result.cipReport.id);
    console.log("Compliance score:", result.complianceScore);
    console.log("=== CREATE CIP REPORT END ===");

    return res.status(201).json({
      message: "CIP report created successfully",
      data: result.cipReport,
      compliance: result.complianceScore
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

    console.log("=== UPDATE CIP REPORT START ===");
    console.log("Report ID:", id);
    console.log("Update data:", JSON.stringify(updateData, null, 2));

    // Check if this is a BCD line update
    const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(updateData.line);

    // Line-specific validation for updates
    if (isBCDLine) {
      if (updateData.line === 'LINE D') {
        // Validate flowRateD for LINE D
        if (updateData.flowRateD !== undefined && parseFloat(updateData.flowRateD) < 6000) {
          return res.status(400).json({ 
            message: "Flow Rate D must be minimum 6000 L/H" 
          });
        }
      } else if (updateData.line === 'LINE B' || updateData.line === 'LINE C') {
        // Validate flowRateBC for LINE B/C
        if (updateData.flowRateBC !== undefined && parseFloat(updateData.flowRateBC) < 9000) {
          return res.status(400).json({ 
            message: "Flow Rate B,C must be minimum 9000 L/H" 
          });
        }
      }
    }

    // Validate temperature and concentration ranges if steps or records are being updated
    if (updateData.steps || updateData.copRecords || updateData.specialRecords) {
      console.log("Validating updated data...");
      const validationErrors = validateCIPData(updateData);
      if (validationErrors.length > 0) {
        console.error("Validation errors:", validationErrors);
        return res.status(400).json({
          message: "Validation failed",
          errors: validationErrors
        });
      }
      console.log("Validation passed");
    }

    // Update the report with compliance calculation
    console.log("Updating CIP report with compliance...");
    const result = await cipService.updateCIPReportWithCompliance(id, updateData, calculateComplianceScore);

    if (!result || !result.cipReport) {
      console.error("CIP report not found");
      return res.status(404).json({ message: "CIP report not found" });
    }

    console.log("CIP report updated successfully");
    console.log("Compliance score:", result.complianceScore);
    console.log("=== UPDATE CIP REPORT END ===");

    return res.status(200).json({
      message: "CIP report updated successfully",
      data: result.cipReport,
      compliance: result.complianceScore
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
      recommendations: generateRecommendations(validationErrors, complianceScore, cipReport.line)
    });
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Helper function to generate recommendations
function generateRecommendations(errors, compliance, line) {
  const recommendations = [];
  const isBCDLine = ['LINE B', 'LINE C', 'LINE D'].includes(line);

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
    if (error.message.includes("Flow")) {
      recommendations.push(`Flow rate adjustment needed: ${error.message}`);
    }
  });

  // Line-specific recommendations
  if (isBCDLine) {
    if (line === 'LINE D' && errors.some(e => e.field === 'flowRateD')) {
      recommendations.push("Check Flow D pump and valves - ensure minimum 6000 L/H");
    }
    if ((line === 'LINE B' || line === 'LINE C') && errors.some(e => e.field === 'flowRateBC')) {
      recommendations.push("Check Flow B,C pumps and valves - ensure minimum 9000 L/H");
    }
    if (errors.some(e => e.message.includes("DRYING"))) {
      recommendations.push("DRYING process: Check heating system for 118-125°C temperature range");
    }
    if (errors.some(e => e.message.includes("DISINFECT"))) {
      recommendations.push("DISINFECT process: Verify chemical concentration (0.3-0.5%) and temperature settings");
    }
  }

  if (compliance.score === 100) {
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