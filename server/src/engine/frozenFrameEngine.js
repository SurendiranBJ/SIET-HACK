/**
 * frozenFrameEngine.js
 * Detects "Suspiciously Perfect Telemetry" — when a student sends a frozen/looping
 * screen frame to make it look like they're on a clean screen.
 *
 * Detection: Two correlated signals must both be true:
 *   1. Perceptual hash similarity: downsampled frame pixel variance < threshold
 *   2. Zero keyboard/mouse activity over the same time window
 */

// Per-student state: { lastFrameHash, frozenSince, frozenCount }
const studentFrameState = {};

/**
 * Compute a simple perceptual signature from a base64 JPEG.
 * We use the raw base64 string length variance as a lightweight proxy
 * (a truly frozen frame will have an identical or near-identical compressed size and prefix).
 * In production, use imagehash library with Hamming distance.
 */
function computeFrameSignature(jpeg_base64) {
  if (!jpeg_base64) return null;
  // Use first 256 chars + last 256 chars + total length as signature
  const len = jpeg_base64.length;
  const prefix = jpeg_base64.slice(0, 256);
  const suffix = jpeg_base64.slice(-256);
  return `${len}:${prefix}:${suffix}`;
}

/**
 * Check if a student's frame is frozen.
 * Returns { isFrozen: bool, frozenSeconds: number }
 */
function checkFrozenFrame(studentId, jpeg_base64, idleSeconds) {
  const sig = computeFrameSignature(jpeg_base64);
  if (!sig) return { isFrozen: false, frozenSeconds: 0 };

  const now = Date.now();
  const state = studentFrameState[studentId] || { lastSig: null, frozenSince: null, sameCount: 0 };

  if (state.lastSig === sig) {
    // Frame unchanged
    state.sameCount = (state.sameCount || 0) + 1;
    if (!state.frozenSince) state.frozenSince = now;

    const frozenSeconds = Math.round((now - state.frozenSince) / 1000);

    // Two correlated signals: frozen screen AND idle input
    const FREEZE_THRESHOLD_SECONDS = 30;
    const IDLE_THRESHOLD_SECONDS = 15;
    const isFrozen = (
      frozenSeconds >= FREEZE_THRESHOLD_SECONDS &&
      idleSeconds >= IDLE_THRESHOLD_SECONDS &&
      state.sameCount >= 10
    );

    studentFrameState[studentId] = state;
    return { isFrozen, frozenSeconds };
  } else {
    // Frame changed — reset
    studentFrameState[studentId] = { lastSig: sig, frozenSince: null, sameCount: 0 };
    return { isFrozen: false, frozenSeconds: 0 };
  }
}

function resetStudentState(studentId) {
  delete studentFrameState[studentId];
}

module.exports = { checkFrozenFrame, resetStudentState };
