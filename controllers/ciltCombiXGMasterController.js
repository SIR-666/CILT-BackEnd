const ciltCombiXGMasterService = require("../services/ciltCombiXGMasterService");

exports.getMaster = async (req, res) => {
    try {
        const { page } = req.query;

        if (!page) {
            return res.status(400).json({ message: "Parameter page is required" });
        }

        const data = await ciltCombiXGMasterService.getMaster(parseInt(page));

        return res.json(data);
    } catch (err) {
        console.error("Error getMaster:", err);
        res.status(500).json({ message: "Server Error", error: err });
    }
};
