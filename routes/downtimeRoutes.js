const express = require("express");
const router = express.Router();
const downtimeController = require("../controllers/downtimeController");

router.get("/getDowntimeList", downtimeController.getDowntimeList);
router.get(
  "/getDowntimeMaster/:line/:category/:mesin",
  downtimeController.getDowntimeMaster
);
router.post("/downtime", downtimeController.createDowntime);
router.get("/getDowntimeOrder", downtimeController.getDowntimeOrder);

module.exports = router;
