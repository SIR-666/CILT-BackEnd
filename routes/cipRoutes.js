const express = require("express");
const router = express.Router();
const cipController = require("../controllers/cipController");

// TEMPLATE ENDPOINTS
// Get CIP types
router.get("/types/list", cipController.getCIPTypes);

// Get CIP status list
router.get("/status/list", cipController.getCIPStatusList);

// Get CIP step templates (dynamic by line)
// GET /cip-report/templates/steps?line=LINE_A&posisi=Final
router.get("/templates/steps", cipController.getCIPStepTemplates);

// Get valve configurations
// GET /cip-report/valve-configurations?posisi=Final
router.get("/valve-configurations", cipController.getValveConfigurations);

// Get flow rate requirements
// GET /cip-report/flow-requirements?line=LINE_A
router.get("/flow-requirements", cipController.getFlowRateRequirements);

// CRUD ENDPOINTS
// Get all CIP reports with optional filters
// GET /cip-report?date=2025-01-01&plant=...&line=...&status=...
router.get("/", cipController.getAllCIPReports);

// Create new CIP report
// POST /cip-report
router.post("/", cipController.createCIPReport);

// SPECIFIC ID ENDPOINTS
// Get CIP report by ID
// GET /cip-report/:id
router.get("/:id", cipController.getCIPReportById);

// Check CIP compliance
// GET /cip-report/:id/compliance
router.get("/:id/compliance", cipController.checkCIPCompliance);

// Submit a draft CIP report (change status from In Progress to Complete)
// PUT /cip-report/:id/submit
router.put("/:id/submit", cipController.submitCIPReport);

// Update CIP report
// PUT /cip-report/:id
router.put("/:id", cipController.updateCIPReport);

// Approve CIP report
// PUT /cip-report/:id/approve
router.put("/:id/approve", cipController.approveCIPReport);

// Reject CIP report
// PUT /cip-report/:id/reject
router.put("/:id/reject", cipController.rejectCIPReport);

// Delete CIP report
// DELETE /cip-report/:id
router.delete("/:id", cipController.deleteCIPReport);

module.exports = router;