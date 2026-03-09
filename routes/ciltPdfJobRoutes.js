const express = require("express");
const router = express.Router();
const ciltPdfJobService = require("../services/ciltPdfJobService");

ciltPdfJobService.ensureCleanupLoop();

router.post("/", async (req, res) => {
  try {
    const { fileName, sheets, extraStyles, requestedBy, chunkSize } = req.body || {};
    const created = ciltPdfJobService.createJob({
      fileName,
      sheets,
      extraStyles,
      requestedBy,
      chunkSize,
    });
    return res.status(202).json(created);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      error: error?.message || "Failed to create PDF job.",
    });
  }
});

router.post("/:jobId/cancel", (req, res) => {
  const { jobId } = req.params;
  const job = ciltPdfJobService.cancelJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "PDF job not found." });
  }
  return res.status(200).json(job);
});

router.get("/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = ciltPdfJobService.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: "PDF job not found." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(job);
});

router.get("/:jobId/print-data", (req, res) => {
  const { jobId } = req.params;
  const { token, offset, limit } = req.query || {};
  const result = ciltPdfJobService.getJobPrintPayload(jobId, {
    token: String(token || ""),
    offset,
    limit,
  });
  if (!result?.ok) {
    return res.status(Number(result?.statusCode) || 400).json({
      error: result?.error || "Failed to load print data.",
    });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(result.payload);
});

router.get("/:jobId/download", (req, res) => {
  const { jobId } = req.params;
  const job = ciltPdfJobService.getJobInternal(jobId);
  if (!job) {
    return res.status(404).json({ error: "PDF job not found." });
  }
  if (job.status !== "completed" || !job.outputPath) {
    return res.status(409).json({
      error: "PDF is not ready yet.",
      status: job.status,
    });
  }

  const inline =
    String(req.query.inline || "").toLowerCase() === "1" ||
    String(req.query.inline || "").toLowerCase() === "true";
  const fileNameRaw = String(req.query.fileName || job.fileName || "cilt-export.pdf");
  const fileName = fileNameRaw.toLowerCase().endsWith(".pdf")
    ? fileNameRaw
    : `${fileNameRaw}.pdf`;
  const dispositionType = inline ? "inline" : "attachment";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${dispositionType}; filename="${fileName}"`
  );
  return res.sendFile(job.outputPath);
});

router.delete("/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const removed = await ciltPdfJobService.removeJob(jobId);
  if (!removed) {
    return res.status(404).json({ error: "PDF job not found." });
  }
  return res.status(200).json({ message: "PDF job removed." });
});

module.exports = router;
