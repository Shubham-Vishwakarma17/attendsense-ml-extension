import type { ParticipationLabel, SessionSample, ValidatedSession } from "../types";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_STUDENTS = 100;
export const LABELS: ParticipationLabel[] = [
  "active_participation",
  "passive_listening",
  "away_from_lecture"
];
const STOP_REASONS = ["user", "monitored_tab_navigated", "monitored_tab_closed"] as const;
const TOP_LEVEL_KEYS = [
  "exportSchemaVersion", "sessionId", "sessionSchemaVersion", "startedAt", "stoppedAt",
  "stopReason", "durationSeconds", "participationLabel", "sampleCount", "samples"
].sort();
const SAMPLE_KEYS = [
  "sampleIndex", "elapsedSeconds", "tabVisible", "windowFocused", "idleSeconds",
  "recentlyInteracted", "facePresent"
].sort();
const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function assertPlainObject(value: unknown, context: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${context} must be a plain object.`);
  }
  for (const key of Object.keys(value)) {
    if (POLLUTION_KEYS.has(key)) throw new Error(`${context} contains a forbidden property.`);
  }
}

function assertExactKeys(value: Record<string, unknown>, allowed: string[], context: string) {
  const actual = Object.keys(value).sort();
  if (actual.length !== allowed.length || actual.some((key, index) => key !== allowed[index])) {
    throw new Error(`${context} contains missing, unexpected, or private properties.`);
  }
}

function finiteNonnegative(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number.`);
  }
  return value;
}

export function parseStudentEmails(value: string): string[] {
  const candidates = value.split(/[\n,]/).map((email) => email.trim().toLowerCase()).filter(Boolean);
  const invalid = candidates.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalid.length) throw new Error(`Invalid student email${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}`);
  const unique = [...new Set(candidates)];
  if (!unique.length) throw new Error("Add at least one student email.");
  if (unique.length > MAX_STUDENTS) throw new Error(`A lecture supports at most ${MAX_STUDENTS} students.`);
  return unique;
}

export function validateMeetUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid Google Meet URL."); }
  if (url.protocol !== "https:" || url.hostname !== "meet.google.com") {
    throw new Error("Use an HTTPS meet.google.com URL.");
  }
  return url.toString();
}

export function validateSessionExport(input: unknown): ValidatedSession {
  assertPlainObject(input, "Session export");
  assertExactKeys(input, TOP_LEVEL_KEYS, "Session export");
  if (input.exportSchemaVersion !== 1) throw new Error("Unsupported export schema version.");
  if (typeof input.sessionId !== "string" || !input.sessionId.trim()) throw new Error("sessionId is required.");
  if (!(input.sessionSchemaVersion === null || Number.isInteger(input.sessionSchemaVersion))) {
    throw new Error("sessionSchemaVersion must be an integer or null.");
  }
  const startedAt = finiteNonnegative(input.startedAt, "startedAt");
  const stoppedAt = finiteNonnegative(input.stoppedAt, "stoppedAt");
  if (stoppedAt < startedAt) throw new Error("Stopped session timestamps are invalid.");
  if (!STOP_REASONS.includes(input.stopReason as typeof STOP_REASONS[number])) throw new Error("Invalid stop reason.");
  const durationSeconds = finiteNonnegative(input.durationSeconds, "durationSeconds");
  if (Math.abs(durationSeconds - Math.floor((stoppedAt - startedAt) / 1000)) > 1) {
    throw new Error("durationSeconds does not match the stopped timestamps.");
  }
  if (!(input.participationLabel === null || LABELS.includes(input.participationLabel as ParticipationLabel))) {
    throw new Error("Invalid participant-provided label.");
  }
  if (!Array.isArray(input.samples) || input.samples.length === 0) throw new Error("A stopped session needs samples.");
  if (input.samples.length > 2160) throw new Error("Session exceeds the 2,160-sample limit.");
  if (input.sampleCount !== input.samples.length) throw new Error("sampleCount does not match samples.length.");

  const samples: SessionSample[] = input.samples.map((sample, index) => {
    assertPlainObject(sample, `Sample ${index}`);
    assertExactKeys(sample, SAMPLE_KEYS, `Sample ${index}`);
    if (sample.sampleIndex !== index) throw new Error("Sample indexes must be unique and sequential from zero.");
    const elapsedSeconds = finiteNonnegative(sample.elapsedSeconds, `Sample ${index} elapsedSeconds`);
    if (typeof sample.tabVisible !== "boolean" || typeof sample.windowFocused !== "boolean" ||
        typeof sample.recentlyInteracted !== "boolean") throw new Error(`Sample ${index} contains an invalid boolean.`);
    const idleSeconds = finiteNonnegative(sample.idleSeconds, `Sample ${index} idleSeconds`);
    if (sample.facePresent !== null) throw new Error("facePresent must be null; camera processing is not supported.");
    return {
      sampleIndex: index, elapsedSeconds, tabVisible: sample.tabVisible,
      windowFocused: sample.windowFocused, idleSeconds,
      recentlyInteracted: sample.recentlyInteracted, facePresent: null
    };
  });
  return {
    exportSchemaVersion: 1,
    sessionId: input.sessionId,
    sessionSchemaVersion: input.sessionSchemaVersion as number | null,
    startedAt, stoppedAt,
    stopReason: input.stopReason as ValidatedSession["stopReason"], durationSeconds,
    participationLabel: input.participationLabel as ParticipationLabel | null,
    sampleCount: samples.length, samples
  };
}

export function calculateSummary(session: ValidatedSession) {
  if (!session.samples.length) throw new Error("Cannot summarize an empty session.");
  const count = session.samples.length;
  const percent = (matching: number) => (matching / count) * 100;
  return {
    durationSeconds: session.durationSeconds,
    sampleCount: count,
    tabVisiblePercent: percent(session.samples.filter((sample) => sample.tabVisible).length),
    windowFocusedPercent: percent(session.samples.filter((sample) => sample.windowFocused).length),
    recentInteractionPercent: percent(session.samples.filter((sample) => sample.recentlyInteracted).length),
    meanIdleSeconds: session.samples.reduce((sum, sample) => sum + sample.idleSeconds, 0) / count
  };
}
