const express = require("express");
const router = express.Router();
const ciltLineMasterController = require("../controllers/ciltLineMasterController");

router.post("/create-from", ciltLineMasterController.createFrom);

module.exports = router;