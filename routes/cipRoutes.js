const express = require("express");
const router = express.Router();
const cipController = require("../controllers/cipController");

// Get all CIP reports with optional filters
router.get("/", cipController.getAllCIPReports);

// Get CIP types
router.get("/types/list", cipController.getCIPTypes);

// Get CIP status list
router.get("/status/list", cipController.getCIPStatusList);

// Get CIP step templates
router.get("/templates/steps", cipController.getCIPStepTemplates);

// Get valve configurations
router.get("/valve-configurations", cipController.getValveConfigurations);

// Get flow rate requirements
router.get("/flow-requirements", cipController.getFlowRateRequirements);

// Get CIP report by ID
router.get("/:id", cipController.getCIPReportById);

// Check CIP compliance
router.get("/:id/compliance", cipController.checkCIPCompliance);

// Submit a draft CIP report (change status from In Progress to Complete)
router.put("/:id/submit", cipController.submitCIPReport);

// Create new CIP report
router.post("/", cipController.createCIPReport);

// Update CIP report
router.put("/:id", cipController.updateCIPReport);

// Delete CIP report
router.delete("/:id", cipController.deleteCIPReport);

module.exports = router;