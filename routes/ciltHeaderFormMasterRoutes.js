const express = require("express");
const router = express.Router();
const headerFormMasterController = require("../controllers/ciltHeaderFormMasterController");

router.get("/", headerFormMasterController.getHeaderFormMasters);
router.post("/create", headerFormMasterController.createHeaderFormMaster);
router.put("/update/:id", headerFormMasterController.updateHeaderFormMaster);
router.delete("/delete/:id", headerFormMasterController.deleteHeaderFormMaster);

module.exports = router;
