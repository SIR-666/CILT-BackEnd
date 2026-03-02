const express = require("express");
const router = express.Router();
const masterGnrController = require("../controllers/ciltGnrMasterController");

router.get("/", masterGnrController.getAllMasterGNR);
router.post("/create", masterGnrController.createGNR);
router.put("/update/:id", masterGnrController.updateGNR);
router.put("/reorder", masterGnrController.reorderGNR);
router.patch("/enable/:id", masterGnrController.enabledGNR);
router.patch("/disable/:id", masterGnrController.disabledGNR);
router.delete("/delete/:id", masterGnrController.deleteGNR);

module.exports = router;
