const ciltPressureService = require("../services/ciltPressureService");

exports.getPressureCheck = async (req, res) => {
    try {
        const { line } = req.query;

        if (!line) {
            return res.status(400).json({ message: "Parameter line not found" });
        }

        const data = await ciltPressureService.getPressureCheck(line);
        return res.json(data);

    } catch (err) {
        console.error("getPressureCheck error:", err);
        res.status(500).json({ message: "Server Error", error: err });
    }
};

exports.getPressureCheck30Min = async (req, res) => {
    try {
        const { line } = req.query;

        if (!line) {
            return res.status(400).json({ message: "Parameter line not found" });
        }

        const data = await ciltPressureService.getPressureCheck30Min(line);
        return res.json(data);

    } catch (err) {
        console.error("getPressureCheck30Min error:", err);
        res.status(500).json({ message: "Server Error", error: err });
    }
};
