import test from "node:test";
import assert from "node:assert/strict";
import {
  CSV_COLUMNS,
  PARTICIPATION_LABELS,
  createCsvExport,
  createJsonExport,
  labelSession
} from "../extension/lib/dataset.js";
import { addSample, createSession, stopSession } from "../extension/lib/session.js";

function stoppedSession(overrides = {}) {
  let session = createSession({ id: "session-1", startedAt: 1000, tabId: 9 });
  session = addSample(session, {
    timestamp: 3500,
    tabVisible: true,
    windowFocused: false,
    idleSeconds: 2.5,
    recentlyInteracted: true,
    facePresent: null
  });
  session = stopSession(session, 11000);
  return { ...session, ...overrides };
}

for (const label of PARTICIPATION_LABELS) {
  test(`accepts valid label ${label}`, () => {
    assert.equal(labelSession(stoppedSession(), label).participationLabel, label);
  });
}

test("rejects an invalid label", () => {
  assert.throws(() => labelSession(stoppedSession(), "attentive"), /available research labels/);
});

test("rejects labelling an active session", () => {
  const active = createSession({ id: "active", startedAt: 1000, tabId: 9 });
  assert.throws(() => labelSession(active, PARTICIPATION_LABELS[0]), /stopped session/);
});

test("rejects labelling an empty stopped session", () => {
  const empty = stopSession(createSession({ id: "empty", startedAt: 1000, tabId: 9 }), 2000);
  assert.throws(() => labelSession(empty, PARTICIPATION_LABELS[0]), /at least one sample/);
});

test("labelling preserves all existing session data", () => {
  const session = stoppedSession();
  const snapshot = structuredClone(session);
  const labelled = labelSession(session, PARTICIPATION_LABELS[0]);
  assert.deepEqual(session, snapshot);
  assert.deepEqual({ ...labelled, participationLabel: null }, session);
});

test("labels a legacy session without schema or label fields", () => {
  const legacy = {
    id: "legacy", active: false, startedAt: 1000, stoppedAt: 2000,
    stopReason: "user", tabId: 9, samples: [{ timestamp: 1500 }]
  };
  assert.equal(labelSession(legacy, PARTICIPATION_LABELS[1]).participationLabel, PARTICIPATION_LABELS[1]);
});

test("CSV has the exact header and deterministic row structure", () => {
  const csv = createCsvExport(labelSession(stoppedSession(), PARTICIPATION_LABELS[0]));
  const [header, row, ending] = csv.split("\n");
  assert.equal(header, CSV_COLUMNS.join(","));
  assert.equal(row, "1,session-1,0,2.5,true,false,2.5,true,,active_participation");
  assert.equal(ending, "");
});

test("CSV always leaves facePresent empty", () => {
  const session = labelSession(stoppedSession(), PARTICIPATION_LABELS[0]);
  session.samples[0].facePresent = true;
  assert.equal(createCsvExport(session).split("\n")[1].split(",")[8], "");
});

test("CSV escapes commas, quotes, and newlines", () => {
  const session = labelSession(stoppedSession({ id: 'id,"quoted"\nline' }), PARTICIPATION_LABELS[0]);
  assert.match(createCsvExport(session), /"id,""quoted""\nline"/);
});

test("JSON uses strict session and sample allowlists", () => {
  const session = labelSession(stoppedSession({
    studentName: "Private Student",
    email: "private@example.com",
    meetingUrl: "https://meet.google.com/private-code"
  }), PARTICIPATION_LABELS[2]);
  session.samples[0].tabTitle = "Private lecture";
  const output = JSON.parse(createJsonExport(session));
  assert.deepEqual(Object.keys(output), [
    "exportSchemaVersion", "sessionId", "sessionSchemaVersion", "startedAt", "stoppedAt",
    "stopReason", "durationSeconds", "participationLabel", "sampleCount", "samples"
  ]);
  assert.deepEqual(Object.keys(output.samples[0]), [
    "sampleIndex", "elapsedSeconds", "tabVisible", "windowFocused", "idleSeconds",
    "recentlyInteracted", "facePresent"
  ]);
  assert.equal(JSON.stringify(output).includes("Private"), false);
  assert.equal(output.samples[0].facePresent, null);
});

for (const [name, session] of [
  ["unlabelled", stoppedSession()],
  ["active", { ...labelSession(stoppedSession(), PARTICIPATION_LABELS[0]), active: true }],
  ["empty", { ...labelSession(stoppedSession(), PARTICIPATION_LABELS[0]), samples: [] }]
]) {
  test(`export rejects an ${name} session`, () => {
    assert.throws(() => createCsvExport(session), /stopped, labelled session/);
    assert.throws(() => createJsonExport(session), /stopped, labelled session/);
  });
}

test("export transformations do not mutate input", () => {
  const session = labelSession(stoppedSession(), PARTICIPATION_LABELS[1]);
  const snapshot = structuredClone(session);
  createCsvExport(session);
  createJsonExport(session);
  assert.deepEqual(session, snapshot);
});
