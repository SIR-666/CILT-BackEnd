const express = require("express");
const router = express.Router();
const masterChecklistController = require("../controllers/ciltChecklistMasterController");

router.get("/", masterChecklistController.getAllMasterChecklist);

module.exports = router;
