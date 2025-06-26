const ciltPackageMasterService = require("../services/ciltPackageMasterService");

exports.getPackageMaster = async (req, res) => {
  try {
    const packageMaster = await ciltPackageMasterService.getPackageMaster();

    if (!packageMaster) {
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
    const package = await ciltPackageMasterService.getPackage();

    if (!package) {
      return res.status(404).json({ message: "Package not found" });
    }

    return res.status(200).json(package);
  } catch (error) {
    console.error("Controller error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
