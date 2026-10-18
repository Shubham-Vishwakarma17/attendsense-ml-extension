import model from "../model/attendsense-demo-model.json";
import type { ParticipationLabel, Prediction, SessionSample } from "../types";

type BrowserModel = typeof model;
const EXPECTED_FEATURES = ["tabVisible", "windowFocused", "idleSeconds", "recentlyInteracted"];

export function stableSoftmax(logits: number[]): number[] {
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function sampleFeatures(sample: SessionSample, artifact: BrowserModel): number[] {
  if (artifact.featureOrder.some((feature, index) => feature !== EXPECTED_FEATURES[index])) {
    throw new Error("Browser model feature order is incompatible.");
  }
  return [
    Number(sample.tabVisible),
    Number(sample.windowFocused),
    Math.min(artifact.idleSecondsClip.maximum, Math.max(artifact.idleSecondsClip.minimum, sample.idleSeconds)),
    Number(sample.recentlyInteracted)
  ];
}

export function predictSession(samples: SessionSample[], artifact: BrowserModel = model): Prediction {
  if (!samples.length) throw new Error("Prediction requires at least one sample.");
  const probabilitySums = artifact.classOrder.map(() => 0);
  for (const sample of samples) {
    const scaled = sampleFeatures(sample, artifact).map(
      (value, index) => (value - artifact.scalerMeans[index]) / artifact.scalerScales[index]
    );
    const logits = artifact.coefficients.map((row, classIndex) =>
      row.reduce((sum, coefficient, index) => sum + coefficient * scaled[index], artifact.intercepts[classIndex])
    );
    stableSoftmax(logits).forEach((value, index) => { probabilitySums[index] += value; });
  }
  const averages = probabilitySums.map((value) => value / samples.length);
  const bestIndex = averages.indexOf(Math.max(...averages));
  return {
    predictionType: "observable participation prediction",
    predictedParticipationLabel: artifact.classOrder[bestIndex] as ParticipationLabel,
    classProbabilities: Object.fromEntries(
      artifact.classOrder.map((label, index) => [label, averages[index]])
    ) as Record<ParticipationLabel, number>,
    modelVersion: artifact.modelVersion,
    datasetKind: "synthetic_demo",
    scientificBoundary: artifact.scientificBoundary
  };
}

export { model as browserModel };
