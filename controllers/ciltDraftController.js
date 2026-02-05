const service = require("../services/ciltDraftService");

// Auto-save draft
exports.autoSave = async (req, res) => {
    try {
        const result = await service.autoSaveDraft(req.body);
        res.json(result);
    } catch (error) {
        console.error("[autoSave] Error:", error);
        res.status(500).json({ 
            error: "Failed to save draft",
            message: error.message 
        });
    }
};

// List all drafts
exports.list = async (_req, res) => {
    try {
        const data = await service.getAllDraft();
        res.json(data);
    } catch (error) {
        console.error("[list] Error:", error);
        res.status(500).json({ 
            error: "Failed to fetch drafts",
            message: error.message 
        });
    }
};

// Get draft details by ID
exports.detail = async (req, res) => {
    try {
        const data = await service.getDraftById(req.params.id);
        if (!data) {
            return res.status(404).json({ 
                error: "Draft not found" 
            });
        }
        res.json(data);
    } catch (error) {
        console.error("[detail] Error:", error);
        res.status(500).json({ 
            error: "Failed to fetch draft",
            message: error.message 
        });
    }
};

// Delete draft by ID
exports.remove = async (req, res) => {
    try {
        await service.deleteDraft(req.params.id);
        res.json({ success: true, message: "Draft deleted successfully" });
    } catch (error) {
        console.error("[remove] Error:", error);
        res.status(500).json({ 
            error: "Failed to delete draft",
            message: error.message 
        });
    }
};

// Submit draft
exports.submit = async (req, res) => {
    try {
        const result = await service.submitDraft(req.params.id);
        res.json(result);
    } catch (error) {
        console.error("[submit] Error:", error);
        res.status(500).json({ 
            error: "Failed to submit draft",
            message: error.message 
        });
    }
};

// Get drafts for shift change
exports.getShiftChangeDrafts = async (req, res) => {
    try {
        const data = await service.getDraftsForShiftChange(req.params.currentShift);
        res.json(data);
    } catch (error) {
        console.error("[getShiftChangeDrafts] Error:", error);
        res.status(500).json({ 
            error: "Failed to fetch shift change drafts",
            message: error.message 
        });
    }
};

// Cleanup empty drafts
exports.cleanup = async (_req, res) => {
    try {
        const deletedCount = await service.cleanupEmptyDrafts();
        res.json({ 
            success: true, 
            message: `Cleaned up ${deletedCount} empty drafts` 
        });
    } catch (error) {
        console.error("[cleanup] Error:", error);
        res.status(500).json({ 
            error: "Failed to cleanup drafts",
            message: error.message 
        });
    }
};