import type { ParticipationLabel } from "../types";

const LABELS: Record<ParticipationLabel, string> = {
  active_participation: "Active participation",
  passive_listening: "Passive listening",
  away_from_lecture: "Away from lecture"
};

export function participationLabel(label: ParticipationLabel | null): string {
  return label ? LABELS[label] : "Not provided";
}

export function PredictionBadge({ label }: { label: ParticipationLabel }) {
  return <span className={`prediction-badge prediction-${label}`}>{participationLabel(label)}</span>;
}

export function ProbabilityBars({ probabilities }: { probabilities: Record<ParticipationLabel, number> }) {
  return <div className="probability-list" aria-label="Class probabilities">
    {(Object.entries(probabilities) as [ParticipationLabel, number][]).map(([label, probability]) => {
      const percentage = probability * 100;
      return <div className="probability-row" key={label}>
        <div className="probability-heading"><span>{participationLabel(label)}</span><strong>{percentage.toFixed(1)}%</strong></div>
        <progress value={probability} max={1} aria-label={`${participationLabel(label)} probability ${percentage.toFixed(1)} percent`} />
      </div>;
    })}
  </div>;
}
