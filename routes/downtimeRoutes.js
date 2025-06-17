const express = require("express");
const router = express.Router();
const downtimeController = require("../controllers/downtimeController");
const { route } = require("./ciltRoutes");

router.get("/getDowntimeList", downtimeController.getDowntimeList);
router.get(
  "/getDowntimeMaster/:line/:category/:mesin",
  downtimeController.getDowntimeMaster
);
router.post("/downtime", downtimeController.createDowntime);
router.put("/downtime", downtimeController.updateDowntime);
router.get("/getDowntimeOrder", downtimeController.getDowntimeOrder);
router.delete("/downtime/:id", downtimeController.deleteDowntime);

module.exports = router;
