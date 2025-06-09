const express = require("express");
const router = express.Router();
const ciltMasterController = require("../controllers/ciltMasterController");

router.get("/plant", ciltMasterController.getPlant);
router.get("/line", ciltMasterController.getLine);
router.get("/machine", ciltMasterController.getMachine);
router.get("/type", ciltMasterController.getType);
router.post("/", ciltMasterController.createMasterCILT);
router.get("/:id", ciltMasterController.getMasterCILT);
router.get("/", ciltMasterController.getAllMasterCILT);
router.put("/:id", ciltMasterController.updateMasterCILT);
router.delete("/:id", ciltMasterController.deleteMasterCILT);

module.exports = router;
