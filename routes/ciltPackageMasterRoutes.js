const express = require("express");
const router = express.Router();
const ciltPackageMasterController = require("../controllers/ciltPackageMasterController");

router.get("/", ciltPackageMasterController.getPackageMaster);
router.get("/package", ciltPackageMasterController.getPackage);
router.get("/by-line", ciltPackageMasterController.getPackageMasterByLine);

module.exports = router;
