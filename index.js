const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const app = express();
const router = express.Router();
app.use(express.json());
app.use(cors());
app.use("/", router);

dotenv.config();

const PORT = process.env.PORT;

app.get("/api", (req, res) => {
  res.send("Welcome to API....");
});

app.listen(PORT, () => {
  console.log("Express API running in port: " + PORT);
});

const ciltRoutes = require("./routes/ciltRoutes");
app.use("/cilt", ciltRoutes);

const ciltMasterRoutes = require("./routes/ciltMasterRoutes");
app.use("/mastercilt", ciltMasterRoutes);

const downtimeRoutes = require("./routes/downtimeRoutes");
app.use("/", downtimeRoutes);

const ciltPackageMasterRoutes = require("./routes/ciltPackageMasterRoutes");
app.use("/package-master", ciltPackageMasterRoutes);

const ciltGnrMasterRoutes = require("./routes/ciltGnrMasterRoutes");
app.use("/gnr-master", ciltGnrMasterRoutes);

const ciltChecklistMasterRoutes = require("./routes/ciltChecklistMasterRoutes");
app.use("/checklist-master", ciltChecklistMasterRoutes);
