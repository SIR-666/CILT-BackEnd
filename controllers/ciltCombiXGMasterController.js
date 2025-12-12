const ciltCombiXGMasterService = require("../services/ciltCombiXGMasterService");

exports.getMaster = async (req, res) => {
    try {
        const { page } = req.query;

        if (!page) {
            return res.status(400).json({
                success: false,
                message: "Parameter page is required",
            });
        }

        const data = await ciltCombiXGMasterService.getMaster(
            parseInt(page)
        );

        return res.status(200).json({
            success: true,
            data: data || [],
        });
    } catch (err) {
        console.error("Error getMaster:", err);
        return res.status(500).json({
            success: false,
            message: "Server Error",
        });
    }
};
