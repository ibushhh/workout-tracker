import "dotenv/config";
import express from "express";
import cors from "cors";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import exerciseRoutes from "./routes/exercises.js";
import cardioActivityRoutes from "./routes/cardioActivities.js";
import dailyLogRoutes from "./routes/dailyLogs.js";
import bodyMeasurementRoutes from "./routes/bodyMeasurements.js";
import templateRoutes from "./routes/templates.js";
import goalRoutes from "./routes/goals.js";
import progressRoutes from "./routes/progress.js";
import exportImportRoutes from "./routes/exportImport.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/exercises", exerciseRoutes);
app.use("/api/cardio-activities", cardioActivityRoutes);
app.use("/api/daily-logs", dailyLogRoutes);
app.use("/api/body-measurements", bodyMeasurementRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/export", exportImportRoutes);

// If a built client exists at server/public (see app/package.json's "deploy"
// script), serve it — API and app share one origin, no CORS config needed.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
if (existsSync(path.join(publicDir, "index.html"))) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Workout Tracker API listening on :${port}`));
