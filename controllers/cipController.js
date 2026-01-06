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

    console.log("[createCIPReport] Is Draft:", isDraft);

    // Only line is required
    if (!cipData.line) {
      return res.status(400).json({ message: "Missing required field: line" });
    }

    // Auto-generate processOrder if not provided
    if (!cipData.processOrder) {
      cipData.processOrder = `CIP-${Date.now()}`;
    }

    // Set defaults
    if (!cipData.plant) {
      cipData.plant = "Milk Filling Packing";
    }

    // Set status
    const status = isDraft ? "In Progress" : "Complete";
    const dataWithStatus = {
      ...cipData,
      status: cipData.status || status,
      isDraft,
      submittedAt: !isDraft ? new Date() : null
    };

    // Validate but don't block
    const validationWarnings = validateCIPData ? validateCIPData(dataWithStatus) : [];

    // Create report
    const result = await cipService.createCIPReportWithCompliance(dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(500).json({ message: "Failed to create CIP report" });
    }

    return res.status(201).json({
      message: isDraft ? "CIP report saved as draft" : "CIP report submitted",
      data: result.cipReport,
      compliance: result.complianceScore,
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      isDraft,
      status: dataWithStatus.status
    });
  } catch (error) {
    console.error("[createCIPReport] Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.updateCIPReport = async (req, res) => {
  try {
    const id = req.params.id;
    const updateData = req.body;
    const isDraft = req.body.isDraft !== false;

    const currentReport = await cipService.getCIPReportById(id);
    if (!currentReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    // Prevent editing submitted reports unless allowed
    if (currentReport.status === 'Complete' && !req.body.allowEditSubmitted) {
      return res.status(400).json({ message: "Cannot edit submitted report" });
    }

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

    const validationWarnings = validateCIPData ? validateCIPData(dataWithStatus) : [];
    const result = await cipService.updateCIPReportWithCompliance(id, dataWithStatus, calculateComplianceScore);

    if (!result || !result.cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    return res.status(200).json({
      message: isDraft ? "CIP report saved as draft" : "CIP report submitted",
      data: result.cipReport,
      compliance: result.complianceScore,
      warnings: validationWarnings.length > 0 ? validationWarnings : undefined,
      isDraft,
      status
    });
  } catch (error) {
    console.error("[updateCIPReport] Controller error:", error);
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

    const result = await cipService.updateCIPReportWithCompliance(id, updateData, calculateComplianceScore);

    return res.status(200).json({
      message: "CIP report submitted successfully",
      data: result.cipReport,
      compliance: result.complianceScore
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
      { id: 1, name: "CIP KITCHEN 1", value: "CIP_KITCHEN_1" },
      { id: 2, name: "CIP KITCHEN 2", value: "CIP_KITCHEN_2" },
      { id: 3, name: "CIP KITCHEN 3", value: "CIP_KITCHEN_3" },
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

// COMPLIANCE CHECK
exports.checkCIPCompliance = async (req, res) => {
  try {
    const id = req.params.id;
    const cipReport = await cipService.getCIPReportById(id);

    if (!cipReport) {
      return res.status(404).json({ message: "CIP report not found" });
    }

    const complianceScore = calculateComplianceScore ? calculateComplianceScore(cipReport) : { score: 0 };
    const validationWarnings = validateCIPData ? validateCIPData(cipReport) : [];

    return res.status(200).json({
      reportId: id,
      compliance: complianceScore,
      validationWarnings
    });
  } catch (error) {
    console.error("[checkCIPCompliance] Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};