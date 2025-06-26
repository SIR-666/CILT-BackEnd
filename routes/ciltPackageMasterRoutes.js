const express = require("express");
const router = express.Router();
const ciltPackageMasterController = require("../controllers/ciltPackageMasterController");

router.get("/", ciltPackageMasterController.getPackageMaster);
router.get("/package", ciltPackageMasterController.getPackage);

module.exports = router;
