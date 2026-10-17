"""Offline session-level inference without label leakage."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .data import APPROVED_LABELS, FEATURE_COLUMNS
from .training import feature_frame


def predict_observable_participation(bundle: dict, frame: pd.DataFrame) -> dict[str, object]:
    expected_features = list(FEATURE_COLUMNS)
    if bundle.get("featureColumns") != expected_features:
        raise ValueError("Model feature allowlist does not match this AttendSense version.")
    if frame["sessionId"].nunique() != 1:
        raise ValueError("Prediction input must contain exactly one session.")

    # Ground truth is intentionally read only after inference and never enters feature_frame().
    probabilities = bundle["model"].predict_proba(feature_frame(frame))
    model_classes = list(bundle["model"].classes_)
    mean_probabilities = probabilities.mean(axis=0)
    probability_map = {
        label: float(mean_probabilities[model_classes.index(label)]) for label in APPROVED_LABELS
    }
    predicted_label = max(APPROVED_LABELS, key=lambda label: probability_map[label])
    participant_labels = frame["participationLabel"].unique()
    participant_label = participant_labels[0] if len(participant_labels) == 1 else None
    return {
        "predictionType": "observable participation prediction",
        "datasetKind": bundle.get("datasetKind", "real"),
        "datasetWarning": bundle.get("datasetWarning"),
        "predictedParticipationLabel": predicted_label,
        "classProbabilities": probability_map,
        "sampleCount": len(frame),
        "sessionId": str(frame.iloc[0]["sessionId"]),
        "participantLabel": participant_label,
        "matchesParticipantLabel": predicted_label == participant_label if participant_label else None,
        "scientificBoundary": "This is not proof of attention, comprehension, learning, or attendance.",
    }
