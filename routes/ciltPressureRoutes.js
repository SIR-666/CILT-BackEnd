const express = require("express");
const router = express.Router();
const ciltPressureController = require("../controllers/ciltPressureController");

router.get("/pressure-check", ciltPressureController.getPressureCheck);
router.get("/pressure-check-30min", ciltPressureController.getPressureCheck30Min);

module.exports = router;
