const ciltPackageMasterService = require("../services/ciltPackageMasterService");

exports.getPackageMaster = async (req, res) => {
  try {
    const { line } = req.query;
    const packageMaster = await ciltPackageMasterService.getPackageMaster(line);

    if (!packageMaster || packageMaster.length === 0) {
      return res.status(404).json({ message: "Package Master not found" });
    }

    return res.status(200).json(packageMaster);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.getPackage = async (req, res) => {
  try {
    const packages = await ciltPackageMasterService.getPackage();

    if (!packages || packages.length === 0) {
      return res.status(404).json({ message: "Package not found" });
    }

    return res.status(200).json(packages);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
