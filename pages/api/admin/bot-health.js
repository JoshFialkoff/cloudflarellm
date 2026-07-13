import fs from "fs";
import path from "path";

const HEALTH_DATA_FILE = path.join(process.cwd(), "data", "bot-health-scores.json");

function normalizeRecord(record = {}) {
  const uptime = record.availability?.uptimePercentage ?? record.uptime ?? null;
  const responseTime = record.aiPerformance?.difyResponseTime ?? record.responseTime ?? null;
  const interactions = record.userExperience?.successfulInteractions
    ?? record.completed_sessions
    ?? record.engaged_sessions
    ?? 0;
  const score = record.overallScore ?? record.effectiveness_score ?? null;
  const status = record.status
    ?? (uptime >= 99 ? "operational" : uptime === null ? "awaiting telemetry" : "degraded");

  return {
    date: record.date ?? record.timestamp ?? null,
    score,
    status,
    uptime,
    responseTime,
    interactions,
    startedSessions: record.started_sessions ?? null,
    engagedSessions: record.engaged_sessions ?? null,
    completedSessions: record.completed_sessions ?? null,
    leadSessions: record.lead_sessions ?? null,
  };
}

export default function handler(req, res) {
  try {
    if (!fs.existsSync(HEALTH_DATA_FILE)) {
      return res.status(200).json({ current: normalizeRecord(), history: [], monitored: false });
    }

    const history = JSON.parse(fs.readFileSync(HEALTH_DATA_FILE, "utf8") || "[]")
      .map(normalizeRecord);
    const current = history[history.length - 1] || normalizeRecord();

    return res.status(200).json({
      current,
      history: history.slice(-14),
      monitored: history.length > 0,
      source: "Automated bot-health scorecard",
    });
  } catch (error) {
    console.error("Error loading bot health metrics:", error);
    return res.status(500).json({ error: "Could not load bot health metrics." });
  }
}
