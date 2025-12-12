const express = require("express");
const router = express.Router();
const ciltCombiXGMasterController = require("../controllers/ciltCombiXGMasterController");

router.get("/xg-master", ciltCombiXGMasterController.getMaster);

module.exports = router;
