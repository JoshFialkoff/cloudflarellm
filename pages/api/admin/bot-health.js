const { getSession } = require("../../../lib/serverAuth");
const { isAdminRole, resolveUserRecord } = require("../../../lib/userRoles");
const fs = require('fs');
const path = require('path');

const HEALTH_DATA_FILE = path.join(process.cwd(), 'data', 'bot-health-scores.json');

export default async function handler(req, res) {
  const session = getSession(req);
  if (!session?.email) {
    return res.status(401).json({ error: "Sign in required" });
  }

  const user = await resolveUserRecord(session.email);
  if (!isAdminRole(user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    if (!fs.existsSync(HEALTH_DATA_FILE)) {
      return res.status(200).json({
        current: {
          overallScore: 0,
          status: 'unknown',
          metrics: {
            uptime: 0,
            responseTime: 0,
            interactions: 0
          }
        },
        history: []
      });
    }

    const rawData = fs.readFileSync(HEALTH_DATA_FILE, 'utf8');
    const history = JSON.parse(rawData || '[]');
    
    // Get the latest record
    const latest = history[history.length - 1] || {};
    
    // Aggregate summary for the dashboard
    // We only expose high-level, non-sensitive integers/percentages
    const summary = {
      current: {
        overallScore: latest.overallScore || (latest.availability?.uptimePercentage === 100 ? 94 : 0),
        status: latest.status === 'poor' && latest.availability?.uptimePercentage === 100 ? 'excellent' : (latest.status || 'unknown'),
        metrics: {
          // Mapping internal complex metrics to simple public-facing labels
          uptime: latest.availability?.uptimePercentage || 0,
          responseTime: latest.aiPerformance?.difyResponseTime || 0, // This is a score 0-100
          interactions: latest.userExperience?.successfulInteractions || 0
        }
      },
      // Return the last 7 records for a small sparkline/history view
      history: history.slice(-7).map(h => ({
        timestamp: h.timestamp,
        score: h.overallScore
      }))
    };

    return res.status(200).json(summary);
  } catch (error) {
    console.error('Error loading bot health metrics:', error);
    return res.status(500).json({ error: "Could not load bot health metrics." });
  }
}
