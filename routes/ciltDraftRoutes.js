const express = require("express");
const router = express.Router();
const controller = require("../controllers/ciltDraftController");

// GET /draft
router.get("/", controller.list);

// Get drafts for shift change
// GET /draft/shift-change/:currentShift
router.get("/shift-change/:currentShift", controller.getShiftChangeDrafts);

// Cleanup empty drafts (maintenance)
// POST /draft/cleanup
router.post("/cleanup", controller.cleanup);

// Auto-save draft (insert/update by processOrder + packageType)
// POST /draft/autosave
router.post("/autosave", controller.autoSave);

// Submit draft to tb_CILT
// POST /draft/submit/:id
router.post("/submit/:id", controller.submit);

// Get draft detail by ID
// GET /draft/:id
router.get("/:id", controller.detail);

// Delete draft
// DELETE /draft/:id
router.delete("/:id", controller.remove);

module.exports = router;