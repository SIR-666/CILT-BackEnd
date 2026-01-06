const cipService = require("../services/cipService");
const cipTemplateService = require("../services/cipTemplateService");
const { validateCIPData, calculateComplianceScore } = require("../services/cipValidationService");

// CRUD ENDPOINTS
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
    console.error("[getAllCIPReports] Controller error:", error);
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
    console.error("[getCIPReportById] Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.createCIPReport = async (req, res) => {
  try {
    const cipData = req.body;
    const isDraft = req.body.isDraft !== false;

    console.log("[createCIPReport] Creating report, Is Draft:", isDraft);

    // Only line is required - MINIMAL VALIDATION
    if (!cipData.line) {
      return res.status(400).json({ message: "Missing required field: line" });
    }

    // Auto-generate processOrder if not provided
    if (!cipData.processOrder) {
      const timestamp = Date.now();
      cipData.processOrder = `CIP-${timestamp}`;
      console.log("[createCIPReport] Auto-generated processOrder:", cipData.processOrder);
    }

    // Set defaults
    if (!cipData.plant) {
      cipData.plant = "Milk Filling Packing";
    }

    // Set status based on isDraft
    const status = isDraft ? "In Progress" : "Complete";
    const dataWithStatus = {
      ...cipData,
      status: cipData.status || status,
      isDraft,
      submittedAt: !isDraft ? new Date() : null
    };

    // NO VALIDATION - Just collect info for reference, don't block
    let validationInfo = [];
    try {
      validationInfo = validateCIPData ? validateCIPData(dataWithStatus) : [];
    } catch (validationError) {
      console.warn("[createCIPReport] Validation check failed (non-blocking):", validationError.message);
    }

    // Create report - ALWAYS SUCCEEDS regardless of validation
    const result = await cipService.createCIPReportWithCompliance(dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(500).json({ message: "Failed to create CIP report" });
    }

    // Return success with optional info (NOT warnings)
    return res.status(201).json({
      success: true,
      message: isDraft ? "CIP report saved as draft" : "CIP report submitted successfully",
      data: result.cipReport,
      compliance: result.complianceScore,
      // Send validation info only if explicitly requested
      validationInfo: req.query.includeValidation === 'true' && validationInfo.length > 0 
        ? validationInfo 
        : undefined,
      isDraft,
      status: dataWithStatus.status
    });
  } catch (error) {
    console.error("[createCIPReport] Controller error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message 
    });
  }
};

exports.updateCIPReport = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const isDraft = req.body.isDraft !== false;

    console.log("[updateCIPReport] Updating report ID:", id, "Is Draft:", isDraft);

    const currentReport = await cipService.getCIPReportById(id);
    if (!currentReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    // Allow editing submitted reports if explicitly allowed
    if (currentReport.status === 'Complete' && !req.body.allowEditSubmitted) {
      return res.status(400).json({ 
        message: "Cannot edit submitted report. Contact admin if changes are needed." 
      });
    }

    // Determine status
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
      submittedAt: !isDraft ? new Date() : currentReport.submittedAt
    };

    // NO VALIDATION - Just collect info for reference, don't block
    let validationInfo = [];
    try {
      validationInfo = validateCIPData ? validateCIPData(dataWithStatus) : [];
    } catch (validationError) {
      console.warn("[updateCIPReport] Validation check failed (non-blocking):", validationError.message);
    }

    // Update report - ALWAYS SUCCEEDS regardless of validation
    const result = await cipService.updateCIPReportWithCompliance(id, dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(404).json({ message: "Failed to update CIP report" });
    }

    // Return success with optional info (NOT warnings)
    return res.status(200).json({
      success: true,
      message: isDraft ? "CIP report updated as draft" : "CIP report updated successfully",
      data: result.cipReport,
      compliance: result.complianceScore,
      // Send validation info only if explicitly requested
      validationInfo: req.query.includeValidation === 'true' && validationInfo.length > 0 
        ? validationInfo 
        : undefined,
      isDraft,
      status
    });
  } catch (error) {
    console.error("[updateCIPReport] Controller error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error",
      error: error.message 
    });
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
    console.error("[deleteCIPReport] Controller error:", error);
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
      return res.status(400).json({ message: "Report already submitted" });
    }

    const updateData = {
      ...currentReport,
      status: "Complete",
      isDraft: false,
      submittedAt: new Date()
    };

    // NO VALIDATION - Just collect info for reference
    let validationInfo = [];
    try {
      validationInfo = validateCIPData ? validateCIPData(updateData) : [];
    } catch (validationError) {
      console.warn("[submitCIPReport] Validation check failed (non-blocking):", validationError.message);
    }

    const result = await cipService.updateCIPReportWithCompliance(id, updateData, calculateComplianceScore);

    return res.status(200).json({
      success: true,
      message: "CIP report submitted successfully",
      data: result.cipReport,
      compliance: result.complianceScore,
      // Send validation info only if explicitly requested
      validationInfo: req.query.includeValidation === 'true' && validationInfo.length > 0 
        ? validationInfo 
        : undefined
    });
  } catch (error) {
    console.error("[submitCIPReport] Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.approveCIPReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, userName } = req.body;

    const result = await cipService.updateApprovalStatus(id, roleId, "approve", userName, new Date());
    res.status(200).json({ message: "Report approved", result });
  } catch (error) {
    console.error("[approveCIPReport] Error:", error);
    res.status(500).json({ message: "Failed to approve report" });
  }
};

exports.rejectCIPReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId, userName } = req.body;

    const result = await cipService.updateApprovalStatus(id, roleId, "reject", userName, new Date());
    res.status(200).json({ message: "Report rejected", result });
  } catch (error) {
    console.error("[rejectCIPReport] Error:", error);
    res.status(500).json({ message: "Failed to reject report" });
  }
};

// STATIC DATA ENDPOINTS
exports.getCIPTypes = async (req, res) => {
  try {
    const cipTypes = [
      { id: 1, name: "CIP KITCHEN 1", value: "CIP KITCHEN 1" },
      { id: 2, name: "CIP KITCHEN 2", value: "CIP KITCHEN 2" },
      { id: 3, name: "CIP KITCHEN 3", value: "CIP KITCHEN 3" },
    ];
    return res.status(200).json(cipTypes);
  } catch (error) {
    console.error("[getCIPTypes] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getCIPStatusList = async (req, res) => {
  try {
    const statusList = [
      { id: 1, name: "In Progress", color: "#FF9800" },
      { id: 2, name: "Complete", color: "#4CAF50" },
      { id: 3, name: "Under Review", color: "#2196F3" },
      { id: 4, name: "Approved", color: "#4CAF50" },
      { id: 5, name: "Rejected", color: "#F44336" },
    ];
    return res.status(200).json(statusList);
  } catch (error) {
    console.error("[getCIPStatusList] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// TEMPLATE ENDPOINTS (from Master Tables)

/**
 * Get CIP Step Templates
 * GET /cip-report/templates/steps?line=LINE A&posisi=Final
 */
exports.getCIPStepTemplates = async (req, res) => {
  try {
    const { line, posisi } = req.query;
    
    console.log("[getCIPStepTemplates] Fetching for line:", line, "posisi:", posisi);
    
    if (line) {
      const template = await cipTemplateService.getTemplateByLine(line, posisi || "Final");
      
      console.log("[getCIPStepTemplates] Template fetched:", {
        cipStepsCount: template.cipSteps?.length || 0,
        specialRecordsCount: template.specialRecords?.length || 0,
        flowRate: template.flowRate,
        valveConfigCount: template.valveConfig?.length || 0,
      });
      
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
    
    // Default: return just steps
    const steps = await cipTemplateService.getCipSteps();
    return res.status(200).json({
      success: true,
      data: { cipSteps: steps },
      message: "Default CIP steps fetched"
    });
  } catch (error) {
    console.error("[getCIPStepTemplates] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
      const config = await cipTemplateService.getValveConfig(posisi);
      return res.status(200).json({ success: true, data: config, posisi });
    }
    
    const [finalConfig, intermediateConfig] = await Promise.all([
      cipTemplateService.getValveConfig("Final"),
      cipTemplateService.getValveConfig("Intermediate")
    ]);
    
    return res.status(200).json({
      success: true,
      data: { Final: finalConfig, Intermediate: intermediateConfig }
    });
  } catch (error) {
    console.error("[getValveConfigurations] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
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
      const flowRate = await cipTemplateService.getFlowRate(line);
      return res.status(200).json({ success: true, data: flowRate, line });
    }
    
    const [lineA, lineB, lineC, lineD] = await Promise.all([
      cipTemplateService.getFlowRate("LINE A"),
      cipTemplateService.getFlowRate("LINE B"),
      cipTemplateService.getFlowRate("LINE C"),
      cipTemplateService.getFlowRate("LINE D"),
    ]);

    return res.status(200).json({
      success: true,
      data: { "LINE A": lineA, "LINE B": lineB, "LINE C": lineC, "LINE D": lineD }
    });
  } catch (error) {
    console.error("[getFlowRateRequirements] Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// COMPLIANCE CHECK (Optional - for admin/reporting only)
exports.checkCIPCompliance = async (req, res) => {
  try {
    const id = req.params.id;
    const cipReport = await cipService.getCIPReportById(id);

    if (!cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    const complianceScore = calculateComplianceScore ? calculateComplianceScore(cipReport) : { score: 0 };
    const validationInfo = validateCIPData ? validateCIPData(cipReport) : [];

    return res.status(200).json({
      reportId: id,
      compliance: complianceScore,
      validationInfo: validationInfo,
      note: "This is for information only and does not affect report validity"
    });
  } catch (error) {
    console.error("[checkCIPCompliance] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};