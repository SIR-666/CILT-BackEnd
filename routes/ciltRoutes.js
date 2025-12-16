const express = require("express");
const router = express.Router();
const ciltController = require("../controllers/ciltController");

// 1. Routes tanpa parameter (paling atas)
router.post("/", ciltController.createCILT);
router.get("/sku", ciltController.getSku);
router.get("/reportCILTAll", ciltController.checkDraft);

// 1b. Master endpoints (untuk dropdown FE)
router.get("/master/plant",   ciltController.getMasterPlant);
router.get("/master/line",    ciltController.getMasterLine);
router.get("/master/package", ciltController.getMasterPackage);

// 2. Routes dengan nama spesifik (sebelum /:id)
router.get("/with-filters", ciltController.getAllCILTWithFilters);
router.get("/getCILTByProcessOrder", ciltController.getCILTByProcessOrder);

// 3. Routes dengan multiple parameters
router.get(
  "/reportCILTAll/:packageType/:plant/:line/:shift/:machine/:date",
  ciltController.getReportCILTAll
);

// 4. Routes untuk approval (dengan /:id tapi spesifik)
router.put("/approve-coordinator/:id", ciltController.approveByCoor);
router.put("/approve-supervisor/:id", ciltController.approveBySpv);
router.get("/approval-status/:id", ciltController.getApprovalStatus);

// 5. Generic routes
router.get("/", ciltController.getAllCILT);
router.get("/:id", ciltController.getCILT);
router.put("/:id", ciltController.updateCILT);
router.delete("/:id", ciltController.deleteCILT);

module.exports = router;
