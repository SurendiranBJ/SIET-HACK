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
    // Map internal student database IDs (e.g. 14) and student_ids (e.g. "108") to display roll numbers
    const studentMap = {};
    students.forEach(s => {
      const displayName = s.student_id || s.name || `Student ${s.id}`;
      studentMap[String(s.id)] = displayName;
      studentMap[String(s.student_id)] = displayName;
    });

    // Filter flags that belong to existing registered students in the system
    const validFlags = (allFlags || []).filter(f => {
      const sid = String(f.student_id);
      return studentMap[sid] !== undefined;
    });

    const flaggedStudentIds = new Set(validFlags.map(f => String(f.student_id)));
    const flaggedCount = Math.min(total, flaggedStudentIds.size);
    const cleanCount = Math.max(0, total - flaggedCount);

    const ruleBreakdown = {};
    validFlags.forEach(f => { 
      const rKey = f.rule_type || 'unknown_rule';
      ruleBreakdown[rKey] = (ruleBreakdown[rKey] || 0) + 1; 
    });
    
    const sortedRules = Object.entries(ruleBreakdown).sort((a, b) => b[1] - a[1]);
    const topRule = sortedRules[0];
    const topRuleFormatted = topRule ? topRule[0].replace(/_/g, ' ') : 'None';

    const flaggedStudentNames = Array.from(flaggedStudentIds).map(id => studentMap[id] || `Candidate ${id}`);
    const criticalCount = validFlags.filter(f => f.severity === 'high' || (f.risk_score_delta && f.risk_score_delta >= 20)).length;

    return {
      generated_at: new Date().toISOString(),
      total_students: total,
      flagged_students: flaggedCount,
      clean_students: cleanCount,
      total_flags: validFlags.length,
      critical_flags: criticalCount,
      most_common_violation: topRuleFormatted,
      rule_breakdown: ruleBreakdown,
      summary: total === 0
        ? 'No active students were registered in this exam session.'
        : `Exam session summary: ${total} candidate(s) monitored. ${flaggedCount} candidate(s) flagged for integrity violations, ${cleanCount} candidate(s) remained clean. Total of ${validFlags.length} violation flag(s) logged. Primary issue: ${topRuleFormatted}.`,
      recommendation: flaggedCount === 0
        ? 'Session integrity verified clean. No proctoring intervention required.'
        : `Faculty Review Advised: Inspect flagged candidate(s) ${flaggedStudentNames.slice(0, 5).join(', ')}${flaggedStudentNames.length > 5 ? ' and others' : ''}.`
    };
  }
}

module.exports = new AIEngine();
