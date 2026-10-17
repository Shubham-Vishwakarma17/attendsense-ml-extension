export const SESSION_STORAGE_KEY = "attendSenseSession";
export const SESSION_SCHEMA_VERSION = 1;
export const MAX_SESSION_SAMPLES = 2160;

export const STOP_REASONS = Object.freeze({
  USER: "user",
  MONITORED_TAB_NAVIGATED: "monitored_tab_navigated",
  MONITORED_TAB_CLOSED: "monitored_tab_closed"
});

const VALID_STOP_REASONS = new Set(Object.values(STOP_REASONS));

function validPercentage(numerator, denominator) {
  return denominator === 0 ? 0 : (numerator / denominator) * 100;
}

export function createSession({ id, startedAt, tabId }) {
  if (!id || !Number.isFinite(startedAt) || !Number.isInteger(tabId)) {
    throw new TypeError("A session requires an id, numeric start time, and tab id.");
  }

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id,
    active: true,
    startedAt,
    stoppedAt: null,
    stopReason: null,
    participationLabel: null,
    tabId,
    samples: []
  };
}

export function addSample(session, sample) {
  if (!session?.active) return session;

  const normalized = {
    timestamp: sample.timestamp,
    tabVisible: Boolean(sample.tabVisible),
    windowFocused: Boolean(sample.windowFocused),
    idleSeconds: Math.max(0, Number(sample.idleSeconds) || 0),
    recentlyInteracted: Boolean(sample.recentlyInteracted),
    facePresent: null
  };

  if (!Number.isFinite(normalized.timestamp)) {
    throw new TypeError("A sample requires a numeric timestamp.");
  }

  const samples = [...session.samples, normalized].slice(-MAX_SESSION_SAMPLES);
  return { ...session, samples };
}

export function stopSession(session, stoppedAt, reason = STOP_REASONS.USER) {
  if (!session?.active) return session;
  if (!Number.isFinite(stoppedAt)) throw new TypeError("Stop time must be numeric.");
  if (!VALID_STOP_REASONS.has(reason)) throw new TypeError("Unknown session stop reason.");
  return { ...session, active: false, stoppedAt, stopReason: reason };
}

export function calculateSessionMetrics(session, now = Date.now()) {
  if (!session) {
    return {
      status: "Not started",
      durationSeconds: 0,
      sampleCount: 0,
      tabVisiblePercentage: 0,
      windowFocusedPercentage: 0,
      interactionPercentage: 0
    };
  }

  const samples = Array.isArray(session.samples) ? session.samples : [];
  const end = session.active ? now : session.stoppedAt ?? now;
  const count = samples.length;

  return {
    status: session.active ? "Active" : "Stopped",
    durationSeconds: Math.max(0, Math.floor((end - session.startedAt) / 1000)),
    sampleCount: count,
    tabVisiblePercentage: validPercentage(samples.filter((s) => s.tabVisible).length, count),
    windowFocusedPercentage: validPercentage(samples.filter((s) => s.windowFocused).length, count),
    interactionPercentage: validPercentage(samples.filter((s) => s.recentlyInteracted).length, count)
  };
}
