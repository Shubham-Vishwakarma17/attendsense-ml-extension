import { describe, expect, it } from "vitest";
import { calculateSummary, parseStudentEmails, validateMeetUrl, validateSessionExport } from "../lib/validation";

const sample = {
  sampleIndex: 0, elapsedSeconds: 0, tabVisible: true, windowFocused: false,
  idleSeconds: 2, recentlyInteracted: true, facePresent: null
};

function validExport() {
  return {
    exportSchemaVersion: 1, sessionId: "session-1", sessionSchemaVersion: 2,
    startedAt: 1_000, stoppedAt: 11_000, stopReason: "user", durationSeconds: 10,
    participationLabel: null, sampleCount: 1, samples: [{ ...sample }]
  };
}

describe("session export validation", () => {
  it("accepts a strict stopped-session export and calculates its summary", () => {
    const session = validateSessionExport(validExport());
    expect(calculateSummary(session)).toEqual({
      durationSeconds: 10, sampleCount: 1, tabVisiblePercent: 100,
      windowFocusedPercent: 0, recentInteractionPercent: 100, meanIdleSeconds: 2
    });
  });

  it.each([
    ["unknown top-level fields", () => ({ ...validExport(), privateValue: "no" })],
    ["unknown sample fields", () => ({ ...validExport(), samples: [{ ...sample, label: "active" }] })],
    ["non-boolean signals", () => ({ ...validExport(), samples: [{ ...sample, tabVisible: 1 }] })],
    ["camera-derived values", () => ({ ...validExport(), samples: [{ ...sample, facePresent: true }] })],
    ["non-sequential indexes", () => ({ ...validExport(), samples: [{ ...sample, sampleIndex: 4 }] })],
    ["invalid timestamps", () => ({ ...validExport(), stoppedAt: 0 })],
    ["count mismatches", () => ({ ...validExport(), sampleCount: 2 })],
    ["invalid labels", () => ({ ...validExport(), participationLabel: "focused" })],
    ["empty active-session shapes", () => ({ ...validExport(), stoppedAt: null })]
  ])("rejects %s", (_name, makeValue) => expect(() => validateSessionExport(makeValue())).toThrow());

  it("rejects more than 2,160 samples", () => {
    const samples = Array.from({ length: 2161 }, (_, index) => ({ ...sample, sampleIndex: index }));
    expect(() => validateSessionExport({ ...validExport(), sampleCount: samples.length, samples })).toThrow(/2,160/);
  });

  it("rejects prototype-pollution keys parsed from JSON", () => {
    const polluted = JSON.parse(JSON.stringify(validExport()).replace('{"exportSchemaVersion"', '{"__proto__":{},"exportSchemaVersion"'));
    expect(() => validateSessionExport(polluted)).toThrow();
  });
});
describe("lecture input validation", () => {
  it("normalizes and deduplicates assigned emails", () => {
    expect(parseStudentEmails(" A@Example.com, a@example.com\nb@example.com ")).toEqual(["a@example.com", "b@example.com"]);
  });
  it("accepts only HTTPS Google Meet URLs", () => {
    expect(validateMeetUrl("https://meet.google.com/abc-defg-hij")).toContain("meet.google.com");
    expect(() => validateMeetUrl("https://example.com/meeting")).toThrow();
    expect(() => validateMeetUrl("http://meet.google.com/abc")).toThrow();
    expect(() => validateMeetUrl("https://meet.google.com.evil.example/abc")).toThrow();
    expect(() => validateMeetUrl("https://google.com/abc")).toThrow();
  });
  it("rejects invalid and oversized student lists", () => {
    expect(() => parseStudentEmails("not-an-email")).toThrow(/Invalid/);
    expect(() => parseStudentEmails(Array.from({ length: 101 }, (_, index) => `student${index}@example.com`).join(","))).toThrow(/100/);
  });
});
