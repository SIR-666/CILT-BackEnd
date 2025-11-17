const express = require("express");
const router = express.Router();
const ciltCustomController = require("../controllers/ciltCustomController");

router.get("/", ciltCustomController.getCustomData);
router.post("/create", ciltCustomController.createCustomData);
router.put("/update/:id", ciltCustomController.updateCustomData);
router.delete("/delete/:id", ciltCustomController.deleteCustomData);

module.exports = router;