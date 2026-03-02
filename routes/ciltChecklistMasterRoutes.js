const express = require("express");
const router = express.Router();
const masterChecklistController = require("../controllers/ciltChecklistMasterController");

router.get("/", masterChecklistController.getAllMasterChecklist);
router.post("/create", masterChecklistController.createChecklist);
router.put("/update/:id", masterChecklistController.updateChecklist);
router.put("/reorder", masterChecklistController.reorderChecklist);
router.patch("/disable/:id", masterChecklistController.disableChecklist);
router.patch("/enable/:id", masterChecklistController.enableChecklist);
router.delete("/delete/:id", masterChecklistController.deleteChecklist);

module.exports = router;
