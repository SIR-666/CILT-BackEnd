const express = require("express");
const router = express.Router();
const ciltCustomMachineController = require("../controllers/ciltCustomMachineController");

router.get("/", ciltCustomMachineController.getCustomMachine);
router.post("/create", ciltCustomMachineController.createCustomMachine);
router.put("/update/:id", ciltCustomMachineController.updateCustomMachine);
router.delete("/delete/:id", ciltCustomMachineController.deleteCustomMachine);

module.exports = router;