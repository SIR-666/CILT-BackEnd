const express = require("express");
const router = express.Router();
const ciltCustomPlantController = require("../controllers/ciltCustomPlantController");

router.get("/", ciltCustomPlantController.getCustomPlant);
router.post("/create", ciltCustomPlantController.createCustomPlant);
router.put("/update/:id", ciltCustomPlantController.updateCustomPlant);
router.delete("/delete/:id", ciltCustomPlantController.deleteCustomPlant);

module.exports = router;
