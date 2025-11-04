const express = require("express");
const router = express.Router();
const ciltLineMasterController = require("../controllers/ciltLineMasterController");

router.post("/create-from", ciltLineMasterController.createFrom);
router.delete("/delete-line/:line", ciltLineMasterController.deleteLine);

module.exports = router;