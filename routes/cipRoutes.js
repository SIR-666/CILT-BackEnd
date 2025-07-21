const express = require("express");
const router = express.Router();
const cipController = require("../controllers/cipController");

// Get all CIP reports with optional filters
router.get("/", cipController.getAllCIPReports);

// Get CIP report by ID
router.get("/:id", cipController.getCIPReportById);

// Create new CIP report
router.post("/", cipController.createCIPReport);

// Update CIP report
router.put("/:id", cipController.updateCIPReport);

// Delete CIP report
router.delete("/:id", cipController.deleteCIPReport);

// Get CIP types
router.get("/types/list", cipController.getCIPTypes);

// Get CIP status list
router.get("/status/list", cipController.getCIPStatusList);

// Get CIP step templates
router.get("/templates/steps", cipController.getCIPStepTemplates);

module.exports = router;