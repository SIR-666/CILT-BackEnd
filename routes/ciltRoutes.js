const express = require("express");
const router = express.Router();
const ciltController = require("../controllers/ciltController");

router.post("/", ciltController.createCILT);
router.get("/sku", ciltController.getSku);
router.get("/reportCILTAll", ciltController.checkDraft);
router.get(
  "/reportCILTAll/:packageType/:plant/:line/:shift/:machine/:date",
  ciltController.getReportCILTAll
);
router.get("/getCILTByProcessOrder", ciltController.getCILTByProcessOrder);
router.get("/", ciltController.getAllCILT);
router.get("/:id", ciltController.getCILT);
router.put("/:id", ciltController.updateCILT);
router.delete("/:id", ciltController.deleteCILT);

module.exports = router;
