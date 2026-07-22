// Per-student rolling baseline for statistical anomaly detection
const studentBaselines = {}; // { student_id: { typing: [], mouse: [], samples: 0 } }

class RulesEngine {
  constructor() {
    this.rules = {};
    this.lastFired = {}; // cooldown map: `${studentId}:${ruleType}` -> timestamp
  }

  getCooldown(ruleType) {
    const cooldowns = {
      tab_switched: 5000,
      idle_timeout: 10000,
      blacklisted_app: 8000,
      secondary_monitor: 10000,
      usb_detected: 8000,
      remote_access_tool: 8000,
      large_clipboard_paste: 5000,
      window_spike: 5000,
      statistical_anomaly: 15000,
    };
    return cooldowns[ruleType] || 8000;
  }

  shouldFire(studentId, ruleType) {
    const key = `${studentId}:${ruleType}`;
    const last = this.lastFired[key] || 0;
    if (Date.now() - last > this.getCooldown(ruleType)) {
      this.lastFired[key] = Date.now();
      return true;
    }
    return false;
  }

  updateBaseline(studentId, typingSpeed, mouseDelta) {
    if (!studentBaselines[studentId]) {
      studentBaselines[studentId] = { typing: [], mouse: [], samples: 0 };
    }
    const b = studentBaselines[studentId];
    b.typing.push(typingSpeed);
    b.mouse.push(mouseDelta);
    b.samples++;
    if (b.typing.length > 30) b.typing.shift();
    if (b.mouse.length > 30) b.mouse.shift();
  }

  checkStatisticalAnomaly(studentId, typingSpeed, mouseDelta) {
    const b = studentBaselines[studentId];
    if (!b || b.samples < 5) return null; // Fast sample check for testing

    const mean = arr => arr.reduce((a, x) => a + x, 0) / arr.length;
    const std = arr => {
      const m = mean(arr);
      return Math.sqrt(arr.reduce((a, x) => a + Math.pow(x - m, 2), 0) / arr.length);
    };

    const typingMean = mean(b.typing);
    const typingStd = std(b.typing);
    const mouseMean = mean(b.mouse);
    const mouseStd = std(b.mouse);

    const typingZscore = typingStd > 0 ? Math.abs(typingSpeed - typingMean) / typingStd : 0;
    const mouseZscore = mouseStd > 0 ? Math.abs(mouseDelta - mouseMean) / mouseStd : 0;

    if (typingZscore > 1.8 && mouseZscore > 1.8) {
      return `Behavioral anomaly: activity deviates ${typingZscore.toFixed(1)}σ from personal baseline`;
    }
    return null;
  }

  async refreshRules(db) {
    try {
      const rows = await db.all(`SELECT * FROM rules WHERE enabled = 1`);
      this.rules = {};
      rows.forEach(r => {
        let parsed = null;
        if (r.threshold_value) {
          try {
            parsed = typeof r.threshold_value === 'string' ? JSON.parse(r.threshold_value) : r.threshold_value;
          } catch(e) {
            if (typeof r.threshold_value === 'string' && r.threshold_value.includes(',')) {
              parsed = r.threshold_value.split(',').map(s => s.trim());
            } else {
              parsed = r.threshold_value;
            }
          }
        }
        this.rules[r.rule_type] = { weight: r.weight, threshold: parsed };
      });
    } catch(e) {
      console.error("Rules refresh error", e);
      this.rules = {};
    }
  }

  async evaluate(telemetryData, db, studentId) {
    await this.refreshRules(db);
    const flags = [];
    const {
      active_window, processes, idle_seconds, usb_events, usb_detected,
      clipboard_size, secondary_monitor, monitor_count, tab_switched,
      keystroke_count, mouse_delta, window_count
    } = telemetryData;

    const procString = (Array.isArray(processes) ? processes.join(' ') : String(processes || '')).toLowerCase();
    const windowTitle = String(active_window || '').toLowerCase();
    const combinedTarget = `${procString} ${windowTitle}`;

    // 1. Blacklisted Apps & Banned Window Titles (ChatGPT, YouTube, WhatsApp, Discord, etc.)
    if (this.rules['blacklisted_app']) {
      const defaultBlacklist = ["discord", "game", "cheat", "cheatengine", "whatsapp", "telegram", "chatgpt", "answers", "youtube"];
      const blacklist = Array.isArray(this.rules['blacklisted_app'].threshold) 
        ? this.rules['blacklisted_app'].threshold 
        : defaultBlacklist;

      for (const app of blacklist) {
        const kw = app.toLowerCase();
        if (combinedTarget.includes(kw) && this.shouldFire(studentId, 'blacklisted_app')) {
          flags.push({ 
            rule_type: 'blacklisted_app', 
            detail: `Unauthorized app/keyword detected: "${app}" (in active window/process)`, 
            weight: this.rules['blacklisted_app'].weight || 30 
          });
          break;
        }
      }
    }

    // 2. Idle Timeout
    if (this.rules['idle_timeout'] && idle_seconds !== undefined) {
      const maxIdle = this.rules['idle_timeout'].threshold?.seconds || 30;
      if (idle_seconds > maxIdle && this.shouldFire(studentId, 'idle_timeout')) {
        flags.push({ 
          rule_type: 'idle_timeout', 
          detail: `Student idle for ${Math.round(idle_seconds)}s (threshold: ${maxIdle}s)`, 
          weight: this.rules['idle_timeout'].weight || 10 
        });
      }
    }

    // 3. Secondary Monitor / Display Detection
    const hasSecondary = secondary_monitor === true || (monitor_count && monitor_count > 1);
    if (this.rules['secondary_monitor'] && hasSecondary && this.shouldFire(studentId, 'secondary_monitor')) {
      flags.push({ 
        rule_type: 'secondary_monitor', 
        detail: `Secondary display/monitor detected (${monitor_count || 2} screens active)`, 
        weight: this.rules['secondary_monitor'].weight || 20 
      });
    }

    // 4. USB Device Connection
    const hasUsb = (usb_events && usb_events.length > 0) || usb_detected === true;
    if (this.rules['usb_detected'] && hasUsb && this.shouldFire(studentId, 'usb_detected')) {
      const detail = (usb_events && usb_events.length > 0) ? `USB plugged: ${usb_events.join(', ')}` : 'USB flash drive connected';
      flags.push({ 
        rule_type: 'usb_detected', 
        detail, 
        weight: this.rules['usb_detected'].weight || 15 
      });
    }

    // 5. Remote Access Tool (AnyDesk, TeamViewer, Zoom, RDP, VNC)
    if (this.rules['remote_access_tool']) {
      const defaultRats = ["teamviewer", "anydesk", "rdp", "zoom", "vnc", "logmein", "parsec", "ammyy"];
      const ratList = Array.isArray(this.rules['remote_access_tool'].threshold) 
        ? this.rules['remote_access_tool'].threshold 
        : defaultRats;

      for (const app of ratList) {
        if (combinedTarget.includes(app.toLowerCase()) && this.shouldFire(studentId, 'remote_access_tool')) {
          flags.push({ 
            rule_type: 'remote_access_tool', 
            detail: `Remote access tool detected: ${app}`, 
            weight: this.rules['remote_access_tool'].weight || 40 
          });
          break;
        }
      }
    }

    // 6. Large Clipboard Paste
    if (this.rules['large_clipboard_paste'] && clipboard_size) {
      const minLen = this.rules['large_clipboard_paste'].threshold?.minLength || 50;
      if (clipboard_size > minLen && this.shouldFire(studentId, 'large_clipboard_paste')) {
        flags.push({ 
          rule_type: 'large_clipboard_paste', 
          detail: `Large clipboard paste detected (${clipboard_size} chars — content not recorded)`, 
          weight: this.rules['large_clipboard_paste'].weight || 25 
        });
      }
    }

    // 7. Tab Switched / Window Spike
    if (this.rules['tab_switched'] && tab_switched && this.shouldFire(studentId, 'tab_switched')) {
      flags.push({ 
        rule_type: 'tab_switched', 
        detail: 'Student navigated away from the exam tab', 
        weight: this.rules['tab_switched'].weight || 25 
      });
    }

    let windowSpikeThreshold = 4;
    if (this.rules['window_spike'] && this.rules['window_spike'].threshold_value) {
      try {
        const tv = typeof this.rules['window_spike'].threshold_value === 'string' 
          ? JSON.parse(this.rules['window_spike'].threshold_value) 
          : this.rules['window_spike'].threshold_value;
        if (tv && typeof tv.count === 'number') windowSpikeThreshold = tv.count;
      } catch (e) {}
    }

    if (this.rules['window_spike'] && window_count && window_count > windowSpikeThreshold && this.shouldFire(studentId, 'window_spike')) {
      flags.push({
        rule_type: 'window_spike',
        detail: `Window spike detected: ${window_count} active open windows (Threshold: >${windowSpikeThreshold})`,
        weight: this.rules['window_spike'].weight || 15
      });
    }

    // 8. Statistical Anomaly (baseline deviation)
    if (this.rules['statistical_anomaly'] && studentId) {
      const ks = typeof keystroke_count === 'number' ? keystroke_count : 0;
      const md = typeof mouse_delta === 'number' ? mouse_delta : 0;
      this.updateBaseline(studentId, ks, md);
      const anomaly = this.checkStatisticalAnomaly(studentId, ks, md);
      if (anomaly && this.shouldFire(studentId, 'statistical_anomaly')) {
        flags.push({ 
          rule_type: 'statistical_anomaly', 
          detail: anomaly, 
          weight: this.rules['statistical_anomaly'].weight || 20 
        });
      }
    }

    return flags;
  }
}

module.exports = new RulesEngine();
