const express = require("express");
const router = express.Router();
const ciltPdfJobService = require("../services/ciltPdfJobService");

ciltPdfJobService.ensureCleanupLoop();

const isInlineDownload = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
};

const sanitizeDownloadFileName = (value, fallback = "cilt-export.pdf") => {
  const base = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|\r\n]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withExt = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  return withExt || fallback;
};

router.post("/v2", async (req, res) => {
  try {
    const {
      fileName,
      items,
      requestedBy,
      chunkSize,
      printBaseUrl,
      renderMode,
    } = req.body || {};

    const created = await ciltPdfJobService.createJobFromItems({
      fileName,
      items,
      requestedBy,
      chunkSize,
      printBaseUrl,
      renderMode,
    });
    return res.status(202).json(created);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      error: error?.message || "Failed to create PDF job via v2 endpoint.",
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

  const inline = isInlineDownload(req.query.inline);
  const fileName = sanitizeDownloadFileName(
    req.query.fileName,
    String(job.fileName || "ciltpro-export.pdf")
  );
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
