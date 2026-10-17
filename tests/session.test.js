import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SESSION_SAMPLES,
  SESSION_SCHEMA_VERSION,
  STOP_REASONS,
  addSample,
  calculateSessionMetrics,
  createSession,
  stopSession
} from "../extension/lib/session.js";

test("creates one versioned active empty session", () => {
  assert.deepEqual(createSession({ id: "s1", startedAt: 1000, tabId: 4 }), {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id: "s1", active: true, startedAt: 1000, stoppedAt: null,
    stopReason: null, tabId: 4, samples: []
  });
});

test("normalizes samples and forces facePresent to null", () => {
  const session = createSession({ id: "s1", startedAt: 1000, tabId: 4 });
  const result = addSample(session, {
    timestamp: 11000,
    tabVisible: 1,
    windowFocused: false,
    idleSeconds: -5,
    recentlyInteracted: true,
    facePresent: true
  });
  assert.deepEqual(result.samples[0], {
    timestamp: 11000,
    tabVisible: true,
    windowFocused: false,
    idleSeconds: 0,
    recentlyInteracted: true,
    facePresent: null
  });
  assert.equal(session.samples.length, 0, "updates are immutable");
});

test("ignores samples after a session has stopped", () => {
  const stopped = stopSession(createSession({ id: "s1", startedAt: 1000, tabId: 4 }), 5000);
  assert.equal(addSample(stopped, { timestamp: 6000 }), stopped);
});

test("bounds samples and preserves the newest samples", () => {
  let session = createSession({ id: "s1", startedAt: 1000, tabId: 4 });
  for (let index = 0; index < MAX_SESSION_SAMPLES + 2; index += 1) {
    session = addSample(session, { timestamp: index, tabVisible: true });
  }
  assert.equal(session.samples.length, MAX_SESSION_SAMPLES);
  assert.equal(session.samples[0].timestamp, 2);
  assert.equal(session.samples.at(-1).timestamp, MAX_SESSION_SAMPLES + 1);
});

for (const [name, reason] of Object.entries(STOP_REASONS)) {
  test(`stores ${name.toLowerCase()} stop reason and rejects later samples`, () => {
    const active = createSession({ id: "s1", startedAt: 1000, tabId: 4 });
    const stopped = stopSession(active, 5000, reason);
    const afterSample = addSample(stopped, { timestamp: 6000, tabVisible: true });
    assert.equal(stopped.stopReason, reason);
    assert.equal(stopped.active, false);
    assert.equal(afterSample, stopped, "a late sample cannot undo Stop");
  });
}

test("calculates duration and sample percentages", () => {
  let session = createSession({ id: "s1", startedAt: 1000, tabId: 4 });
  session = addSample(session, { timestamp: 11000, tabVisible: true, windowFocused: true, recentlyInteracted: false });
  session = addSample(session, { timestamp: 21000, tabVisible: false, windowFocused: true, recentlyInteracted: true });
  const metrics = calculateSessionMetrics(session, 31000);
  assert.deepEqual(metrics, {
    status: "Active",
    durationSeconds: 30,
    sampleCount: 2,
    tabVisiblePercentage: 50,
    windowFocusedPercentage: 100,
    interactionPercentage: 50
  });
});

test("uses stop time for a stopped session", () => {
  const session = stopSession(createSession({ id: "s1", startedAt: 1000, tabId: 4 }), 12500);
  assert.equal(calculateSessionMetrics(session, 99999).durationSeconds, 11);
  assert.equal(calculateSessionMetrics(session).status, "Stopped");
});

test("returns safe zero metrics without a session", () => {
  assert.equal(calculateSessionMetrics(null).sampleCount, 0);
  assert.equal(calculateSessionMetrics(null).tabVisiblePercentage, 0);
});

test("calculates metrics for a legacy session without a schema version", () => {
  const legacy = {
    id: "legacy", active: false, startedAt: 1000, stoppedAt: 11000, tabId: 4,
    samples: [{ tabVisible: true, windowFocused: false, recentlyInteracted: true }]
  };
  assert.deepEqual(calculateSessionMetrics(legacy), {
    status: "Stopped",
    durationSeconds: 10,
    sampleCount: 1,
    tabVisiblePercentage: 100,
    windowFocusedPercentage: 0,
    interactionPercentage: 100
  });
});
