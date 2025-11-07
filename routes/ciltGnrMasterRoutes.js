const express = require("express");
const router = express.Router();
const masterGnrController = require("../controllers/ciltGnrMasterController");

router.get("/", masterGnrController.getAllMasterGNR);
router.post("/create", masterGnrController.createGNR);
router.put("update/:id", masterGnrController.updateGNR);
router.put("enable/:id", masterGnrController.updateGNR);
router.put("disable/:id", masterGnrController.updateGNR);

module.exports = router;
