const express = require("express");
const router = express.Router();
const ciltCustomController = require("../controllers/ciltCustomController");

// Metadata routes (tb_CILT_custom, tb_CILT_custom_machine, tb_CILT_custom_material, tb_CILT_custom_plant)
router.get("/", ciltCustomController.getCustomData);
router.get("/parsed", ciltCustomController.getCustomDataWithParsed);
router.get("/:id", ciltCustomController.getCustomDataById);
router.post("/create", ciltCustomController.createCustomData);
router.put("/update/:id", ciltCustomController.updateCustomData);
router.delete("/delete/:id", ciltCustomController.deleteCustomData);
router.put("/update-with-relations/:id", ciltCustomController.updatePackageWithRelations);

// Package Designer routes (tb_CILT_custom_packages)
router.get("/packages/:id", ciltCustomController.getCustomPackageById);
router.get("/packages", ciltCustomController.getCustomPackages);
router.post("/packages/create", ciltCustomController.createCustomPackage);
router.put("/packages/update/:id", ciltCustomController.updateCustomPackage);
router.delete("/packages/delete/:id", ciltCustomController.deleteCustomPackage);

module.exports = router;