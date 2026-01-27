const service = require("../services/ciltDraftService");

exports.autoSave = async (req, res) => {
    const result = await service.autoSaveDraft(req.body);
    res.json(result);
};

exports.list = async (_req, res) => {
    const data = await service.getAllDraft();
    res.json(data);
};

exports.detail = async (req, res) => {
    const data = await service.getDraftById(req.params.id);
    res.json(data);
};

exports.remove = async (req, res) => {
    await service.deleteDraft(req.params.id);
    res.json({ success: true });
};

exports.submit = async (req, res) => {
    const result = await service.submitDraft(req.params.id);
    res.json(result);
};