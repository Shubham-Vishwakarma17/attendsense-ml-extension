import { calculateSessionMetrics } from "./session.js";

export const EXPORT_SCHEMA_VERSION = 1;
export const PARTICIPATION_LABELS = Object.freeze([
  "active_participation",
  "passive_listening",
  "away_from_lecture"
]);

export const CSV_COLUMNS = Object.freeze([
  "schemaVersion",
  "sessionId",
  "sampleIndex",
  "elapsedSeconds",
  "tabVisible",
  "windowFocused",
  "idleSeconds",
  "recentlyInteracted",
  "facePresent",
  "participationLabel"
]);

export function isValidParticipationLabel(label) {
  return PARTICIPATION_LABELS.includes(label);
}

export function labelSession(session, label) {
  if (!session || session.active) {
    throw new TypeError("Only a stopped session can be labelled.");
  }
  if (!Array.isArray(session.samples) || session.samples.length === 0) {
    throw new TypeError("A session needs at least one sample before it can be labelled.");
  }
  if (!isValidParticipationLabel(label)) {
    throw new TypeError("Select one of the available research labels.");
  }
  return { ...session, participationLabel: label };
}

export function isExportableSession(session) {
  return Boolean(
    session &&
    !session.active &&
    Array.isArray(session.samples) &&
    session.samples.length > 0 &&
    isValidParticipationLabel(session.participationLabel)
  );
}

function assertExportable(session) {
  if (!isExportableSession(session)) {
    throw new TypeError("Export requires a stopped, labelled session with at least one sample.");
  }
}

function elapsedSeconds(timestamp, startedAt) {
  return Math.max(0, (timestamp - startedAt) / 1000);
}

function toExportSample(sample, sampleIndex, startedAt) {
  return {
    sampleIndex,
    elapsedSeconds: elapsedSeconds(sample.timestamp, startedAt),
    tabVisible: Boolean(sample.tabVisible),
    windowFocused: Boolean(sample.windowFocused),
    idleSeconds: Math.max(0, Number(sample.idleSeconds) || 0),
    recentlyInteracted: Boolean(sample.recentlyInteracted),
    facePresent: null
  };
}

function escapeCsv(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createCsvExport(session) {
  assertExportable(session);
  const rows = session.samples.map((sample, sampleIndex) => {
    const exported = toExportSample(sample, sampleIndex, session.startedAt);
    return [
      EXPORT_SCHEMA_VERSION,
      session.id,
      exported.sampleIndex,
      exported.elapsedSeconds,
      exported.tabVisible,
      exported.windowFocused,
      exported.idleSeconds,
      exported.recentlyInteracted,
      "",
      session.participationLabel
    ].map(escapeCsv).join(",");
  });
  return `${CSV_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}

export function createJsonExport(session) {
  assertExportable(session);
  const output = {
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    sessionId: session.id,
    sessionSchemaVersion: Number.isInteger(session.schemaVersion) ? session.schemaVersion : null,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt,
    stopReason: session.stopReason ?? null,
    durationSeconds: calculateSessionMetrics(session).durationSeconds,
    participationLabel: session.participationLabel,
    sampleCount: session.samples.length,
    samples: session.samples.map((sample, index) => toExportSample(sample, index, session.startedAt))
  };
  return `${JSON.stringify(output, null, 2)}\n`;
}

export function createExportFilename(session, extension) {
  if (!isExportableSession(session) || !["csv", "json"].includes(extension)) {
    throw new TypeError("A valid export session and file type are required.");
  }
  const safeSessionId = String(session.id).replace(/[^a-zA-Z0-9_-]+/g, "_");
  return `attendsense_${safeSessionId}_${session.participationLabel}.${extension}`;
}
