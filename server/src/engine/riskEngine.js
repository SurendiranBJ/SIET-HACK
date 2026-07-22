const db = require('../config/db');

class RiskEngine {
  async computeRiskScore(studentId, sessionId, db) {
    // Basic risk scoring: Sum of risk deltas over the last 15 minutes, max 100
    const rows = await db.all(`
      SELECT risk_score_delta, created_at 
      FROM flags 
      WHERE student_id = ? AND session_id = ? AND status != 'dismissed'
      ORDER BY created_at DESC
    `, [studentId, sessionId]);

    let totalRisk = 0;
    const now = new Date().getTime();

    rows.forEach(flag => {
      // In SQLite datetime is ISO string by default usually if using CURRENT_TIMESTAMP, 
      // but assuming utc timestamp parsing here.
      let flagTime = new Date(flag.created_at + 'Z').getTime();
      if(isNaN(flagTime)) {
         flagTime = new Date(flag.created_at).getTime();
      }

      const minutesAgo = (now - flagTime) / (1000 * 60);

      if (minutesAgo < 15) {
        // Linear decay over 15 minutes
        const decayFactor = Math.max(0, (15 - minutesAgo) / 15);
        totalRisk += flag.risk_score_delta * decayFactor;
      }
    });

    return Math.min(100, Math.floor(totalRisk));
  }
}

module.exports = new RiskEngine();
