const express = require("express");
const router = express.Router();
const masterChecklistController = require("../controllers/ciltChecklistMasterController");

router.get("/", masterChecklistController.getAllMasterChecklist);
router.post("/create", masterChecklistController.createChecklist);
router.put("/update/:id", masterChecklistController.updateChecklist);
router.put("/disable/:id", masterChecklistController.disableChecklist);
router.put("/enable/:id", masterChecklistController.enableChecklist);

module.exports = router;
