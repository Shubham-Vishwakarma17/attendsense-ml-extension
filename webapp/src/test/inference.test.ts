import { describe, expect, it } from "vitest";
import { browserModel, predictSession, stableSoftmax } from "../lib/inference";
import type { ParticipationLabel, SessionSample } from "../types";

const build = (rows: Array<[boolean, boolean, number, boolean]>): SessionSample[] => rows.map((row, index) => ({
  sampleIndex: index, elapsedSeconds: index * 10, tabVisible: row[0], windowFocused: row[1],
  idleSeconds: row[2], recentlyInteracted: row[3], facePresent: null
}));

const cases = [
  ["active_participation", build([[true,true,2.174,true],[true,false,1.152,true],[true,true,4.29,true],[true,true,4.587,true],[true,true,.549,true],[true,true,1.666,true]]), [0.866088030487969,0.0006424492191571021,0.13326952029287378]],
  ["passive_listening", build([[true,true,26.458,false],[true,true,27.312,false],[true,true,44.92,true],[true,false,54.37,false],[true,true,78.253,true],[true,true,83.241,false]]), [0.3157007489841139,0.032809436922928224,0.6514898140929579]],
  ["away_from_lecture", build([[false,false,148.753,false],[false,false,163.128,false],[false,false,197.39,false],[true,false,264.915,false],[true,false,254.586,false],[false,false,290.324,false]]), [0.00015465840665566404,0.9412166716623679,0.05862866993097638]]
] as const;

describe("browser inference parity", () => {
  it.each(cases)("matches Python probabilities for %s", (label, samples, expected) => {
    const prediction = predictSession(samples);
    expect(prediction.predictedParticipationLabel).toBe(label);
    browserModel.classOrder.forEach((name, index) => {
      expect(prediction.classProbabilities[name as ParticipationLabel]).toBeCloseTo(expected[index], 12);
    });
  });
  it("uses a numerically stable softmax", () => {
    expect(stableSoftmax([10_000, 10_000]).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("is deterministic and exposes only the approved feature order", () => {
    expect(browserModel.featureOrder).toEqual(["tabVisible", "windowFocused", "idleSeconds", "recentlyInteracted"]);
    expect(predictSession(cases[0][1])).toEqual(predictSession(cases[0][1]));
  });
  it("rejects incompatible feature ordering", () => {
    const altered = { ...browserModel, featureOrder: ["idleSeconds", "windowFocused", "tabVisible", "recentlyInteracted"] };
    expect(() => predictSession(cases[0][1], altered)).toThrow(/feature order/);
  });
});
