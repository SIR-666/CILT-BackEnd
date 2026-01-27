const express = require("express");
const router = express.Router();
const controller = require("../controllers/ciltDraftController");

// list draft (ListCILTDraft.jsx)
router.get("/", controller.list);

// autosave (insert / update by processOrder)
router.post("/autosave", controller.autoSave);

// submit draft → tb_CILT (specific route with /submit prefix)
router.post("/submit/:id", controller.submit);

// delete draft
router.delete("/:id", controller.remove);

// detail draft
router.get("/:id", controller.detail);

module.exports = router;