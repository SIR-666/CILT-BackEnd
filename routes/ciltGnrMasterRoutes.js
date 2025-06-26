const express = require("express");
const router = express.Router();
const masterGnrController = require("../controllers/ciltGnrMasterController");

router.get("/", masterGnrController.getAllMasterGNR);

module.exports = router;
