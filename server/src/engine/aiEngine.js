class AIEngine {
  async generateSuspicionExplanation(studentId, flags, riskScore) {
    if (!flags || flags.length === 0) {
      return {
        explanation: 'No suspicious behavior detected. Student appears to be working normally.',
        confidence: 'low',
        suggestedAction: 'Continue monitoring',
        reasons: []
      };
    }

    // Smart offline fallback with context-aware responses
    const ruleMessages = {
      tab_switched: 'Student repeatedly navigated away from the exam tab, suggesting possible reference to external resources.',
      idle_timeout: 'Extended periods of inactivity detected, possibly indicating the student stepped away or is distracted.',
      blacklisted_app: 'Unauthorized application detected running during the exam session.',
      remote_access_tool: 'Remote desktop/screen-sharing software detected — a critical integrity violation.',
      large_clipboard_paste: 'Unusually large clipboard paste detected, suggesting content may have been imported from an external source.',
      secondary_monitor: 'Secondary display detected, which may be used to reference hidden notes or resources.',
      usb_detected: 'USB device connected during exam, potentially used to transfer files.',
      statistical_anomaly: 'Behavioral pattern deviates significantly from this student\'s own baseline.',
      window_spike: 'Rapid window switching detected, indicating possible multi-tasking with hidden apps.'
    };

    const uniqueRules = [...new Set(flags.map(f => f.rule_type))];
    const reasons = uniqueRules.map(r => ruleMessages[r] || flags.find(f => f.rule_type === r)?.detail || r);

    let confidence = 'low';
    let suggestedAction = 'Continue passive monitoring';
    let explanation = '';

    if (riskScore >= 60 || uniqueRules.includes('remote_access_tool') || uniqueRules.includes('blacklisted_app')) {
      confidence = 'high';
      suggestedAction = 'Inspect student immediately — strong evidence of exam misconduct';
      explanation = `HIGH RISK (${riskScore}%): Multiple critical violations detected. Immediate faculty intervention recommended.`;
    } else if (riskScore >= 30) {
      confidence = 'medium';
      suggestedAction = 'Observe student closely and review incident timeline';
      explanation = `MODERATE RISK (${riskScore}%): ${reasons.length} behavioral indicator(s) flagged. Manual review advised.`;
    } else {
      confidence = 'low';
      suggestedAction = 'Keep monitoring — low-level indicators present';
      explanation = `LOW RISK (${riskScore}%): Minor behavioral flags detected. May be accidental.`;
    }

    return { explanation, confidence, suggestedAction, reasons };
  }

  async generateSessionSummary(students, allFlags) {
    const total = students.length;
    const flaggedStudents = [...new Set(allFlags.map(f => f.student_id))];
    const criticalCount = allFlags.filter(f => f.severity === 'high' && f.risk_score_delta >= 30).length;
    const ruleBreakdown = {};
    allFlags.forEach(f => { ruleBreakdown[f.rule_type] = (ruleBreakdown[f.rule_type] || 0) + 1; });
    const topRule = Object.entries(ruleBreakdown).sort((a, b) => b[1] - a[1])[0];

    return {
      generated_at: new Date().toISOString(),
      total_students: total,
      flagged_students: flaggedStudents.length,
      clean_students: total - flaggedStudents.length,
      total_flags: allFlags.length,
      critical_flags: criticalCount,
      most_common_violation: topRule ? topRule[0] : 'None',
      rule_breakdown: ruleBreakdown,
      summary: `Session completed with ${total} students monitored. ${flaggedStudents.length} student(s) triggered behavioral flags. ${criticalCount} critical violation(s) detected. Most common issue: ${topRule ? topRule[0].replace(/_/g, ' ') : 'none'}.`,
      recommendation: flaggedStudents.length === 0 
        ? 'Session appears clean. No action required.'
        : `Review flagged students: ${flaggedStudents.slice(0, 5).join(', ')}${flaggedStudents.length > 5 ? ' and more' : ''}.`
    };
  }
}

module.exports = new AIEngine();
