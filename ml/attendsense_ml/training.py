"""Leakage-safe grouped evaluation and model training for observable participation."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, precision_recall_fscore_support
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from .data import (
    APPROVED_LABELS,
    FEATURE_COLUMNS,
    SYNTHETIC_WARNING,
    validate_dataset_kind,
)

RANDOM_SEED = 42
MIN_SESSIONS_PER_CLASS = 3
IDLE_SECONDS_CLIP_MAX = 3600.0
SELECTION_METRIC = "session_level_macro_f1"


class TrainingDataError(ValueError):
    """Raised when honest grouped evaluation is impossible."""


def feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Return the exact predictive allowlist with stable numeric conversion."""
    missing = [column for column in FEATURE_COLUMNS if column not in frame]
    if missing:
        raise TrainingDataError(f"Missing predictive features: {missing}")
    features = pd.DataFrame(index=frame.index)
    features["tabVisible"] = frame["tabVisible"].astype(bool).astype(int)
    features["windowFocused"] = frame["windowFocused"].astype(bool).astype(int)
    features["idleSeconds"] = pd.to_numeric(frame["idleSeconds"], errors="raise").clip(
        lower=0, upper=IDLE_SECONDS_CLIP_MAX
    )
    features["recentlyInteracted"] = frame["recentlyInteracted"].astype(bool).astype(int)
    return features.loc[:, FEATURE_COLUMNS]


def validate_training_population(frame: pd.DataFrame) -> dict[str, int]:
    session_labels = frame[["sessionId", "participationLabel"]].drop_duplicates()
    if session_labels.groupby("sessionId")["participationLabel"].nunique().gt(1).any():
        raise TrainingDataError("Each sessionId must have exactly one participation label.")
    counts = Counter(session_labels["participationLabel"])
    missing = [label for label in APPROVED_LABELS if counts[label] < MIN_SESSIONS_PER_CLASS]
    if missing:
        details = ", ".join(f"{label}={counts[label]}" for label in APPROVED_LABELS)
        raise TrainingDataError(
            f"Grouped evaluation requires at least {MIN_SESSIONS_PER_CLASS} independent sessions "
            f"per class; found {details}."
        )
    return {label: int(counts[label]) for label in APPROVED_LABELS}


def grouped_splits(frame: pd.DataFrame):
    counts = validate_training_population(frame)
    split_count = min(5, min(counts.values()))
    splitter = StratifiedGroupKFold(n_splits=split_count, shuffle=True, random_state=RANDOM_SEED)
    return list(
        splitter.split(
            feature_frame(frame),
            frame["participationLabel"],
            groups=frame["sessionId"],
        )
    )


def model_candidates() -> dict[str, Pipeline]:
    return {
        "logistic_regression": Pipeline(
            [
                ("scale", StandardScaler()),
                (
                    "model",
                    LogisticRegression(
                        max_iter=2000, class_weight="balanced", random_state=RANDOM_SEED
                    ),
                ),
            ]
        ),
        "decision_tree": Pipeline(
            [
                (
                    "model",
                    DecisionTreeClassifier(
                        max_depth=5, class_weight="balanced", random_state=RANDOM_SEED
                    ),
                )
            ]
        ),
        "random_forest": Pipeline(
            [
                (
                    "model",
                    RandomForestClassifier(
                        n_estimators=100,
                        max_depth=8,
                        min_samples_leaf=2,
                        class_weight="balanced",
                        random_state=RANDOM_SEED,
                        n_jobs=1,
                    ),
                )
            ]
        ),
    }


def _metric_block(actual, predicted) -> dict[str, object]:
    precision, recall, f1, _ = precision_recall_fscore_support(
        actual, predicted, labels=APPROVED_LABELS, average="macro", zero_division=0
    )
    return {
        "accuracy": float(accuracy_score(actual, predicted)),
        "macroPrecision": float(precision),
        "macroRecall": float(recall),
        "macroF1": float(f1),
        "confusionMatrix": confusion_matrix(actual, predicted, labels=APPROVED_LABELS).tolist(),
        "classOrder": list(APPROVED_LABELS),
    }


def _session_results(frame: pd.DataFrame, probabilities: np.ndarray):
    records = []
    for session_id in sorted(frame["sessionId"].unique()):
        mask = frame["sessionId"].to_numpy() == session_id
        mean_probabilities = probabilities[mask].mean(axis=0)
        actual_labels = frame.loc[mask, "participationLabel"].unique()
        if len(actual_labels) != 1:
            raise TrainingDataError(f"Session {session_id!r} contains multiple labels.")
        records.append((session_id, actual_labels[0], APPROVED_LABELS[int(np.argmax(mean_probabilities))]))
    actual = [record[1] for record in records]
    predicted = [record[2] for record in records]
    return actual, predicted


def evaluate_models(frame: pd.DataFrame):
    features = feature_frame(frame)
    target = frame["participationLabel"].to_numpy()
    splits = grouped_splits(frame)
    results: dict[str, dict[str, object]] = {}

    for name, candidate in model_candidates().items():
        probabilities = np.zeros((len(frame), len(APPROVED_LABELS)), dtype=float)
        for train_indices, validation_indices in splits:
            train_groups = set(frame.iloc[train_indices]["sessionId"])
            validation_groups = set(frame.iloc[validation_indices]["sessionId"])
            if train_groups & validation_groups:
                raise TrainingDataError("A session appeared in both training and validation folds.")
            candidate.fit(features.iloc[train_indices], target[train_indices])
            fold_probabilities = candidate.predict_proba(features.iloc[validation_indices])
            class_positions = {label: index for index, label in enumerate(candidate.classes_)}
            for output_index, label in enumerate(APPROVED_LABELS):
                probabilities[validation_indices, output_index] = fold_probabilities[
                    :, class_positions[label]
                ]

        sample_predictions = np.asarray(APPROVED_LABELS)[np.argmax(probabilities, axis=1)]
        session_actual, session_predictions = _session_results(frame, probabilities)
        results[name] = {
            "sampleLevel": _metric_block(target, sample_predictions),
            "sessionLevel": _metric_block(session_actual, session_predictions),
        }

    selected = max(
        results,
        key=lambda name: (results[name]["sessionLevel"]["macroF1"], -list(results).index(name)),
    )
    return results, selected, splits


def _dataset_counts(frame: pd.DataFrame) -> dict[str, object]:
    sessions = frame[["sessionId", "participationLabel"]].drop_duplicates()
    return {
        "sampleCount": len(frame),
        "sessionCount": int(frame["sessionId"].nunique()),
        "samplesPerClass": {
            label: int((frame["participationLabel"] == label).sum()) for label in APPROVED_LABELS
        },
        "sessionsPerClass": {
            label: int((sessions["participationLabel"] == label).sum()) for label in APPROVED_LABELS
        },
    }


def train_and_write_artifacts(
    frame: pd.DataFrame, artifact_dir: str | Path, *, dataset_kind: str = "real"
) -> dict[str, object]:
    validate_dataset_kind(dataset_kind)
    results, selected_name, splits = evaluate_models(frame)
    features = feature_frame(frame)
    selected_model = model_candidates()[selected_name]
    selected_model.fit(features, frame["participationLabel"])

    output_dir = Path(artifact_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": selected_model,
        "featureColumns": list(FEATURE_COLUMNS),
        "classLabels": list(APPROVED_LABELS),
        "idleSecondsClipMax": IDLE_SECONDS_CLIP_MAX,
        "predictionMeaning": "observable browser participation state",
        "datasetKind": dataset_kind,
        "datasetWarning": SYNTHETIC_WARNING if dataset_kind == "synthetic_demo" else None,
    }
    joblib.dump(bundle, output_dir / "best_model.joblib")

    counts = _dataset_counts(frame)
    metrics = {
        "datasetKind": dataset_kind,
        "datasetWarning": SYNTHETIC_WARNING if dataset_kind == "synthetic_demo" else None,
        "dataset": counts,
        "groupedCrossValidation": {
            "strategy": "StratifiedGroupKFold",
            "foldCount": len(splits),
            "group": "sessionId",
            "shuffle": True,
        },
        "models": results,
        "selectedModel": selected_name,
        "selectionMetric": SELECTION_METRIC,
        "randomSeed": RANDOM_SEED,
        "features": list(FEATURE_COLUMNS),
        "scientificLimitations": [
            "Predictions describe observable browser participation, not attention, learning, or comprehension.",
            "Participant-provided session labels may be noisy and cannot represent within-session changes.",
            "Performance from a small or controlled dataset may not generalize to other people or environments.",
        ],
    }
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    feature_summary = {
        "predictiveFeatures": list(FEATURE_COLUMNS),
        "excludedFromPrediction": [
            "sessionId", "schemaVersion", "sampleIndex", "elapsedSeconds",
            "participationLabel", "facePresent",
        ],
        "booleanEncoding": "false=0, true=1",
        "idleSeconds": {
            "clipMinimum": 0,
            "clipMaximum": IDLE_SECONDS_CLIP_MAX,
            "logisticRegressionScaling": "StandardScaler fitted within each training fold",
        },
    }
    (output_dir / "feature_summary.json").write_text(
        json.dumps(feature_summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    training_summary = {
        **counts,
        "datasetKind": dataset_kind,
        "datasetWarning": SYNTHETIC_WARNING if dataset_kind == "synthetic_demo" else None,
        "selectedModel": selected_name,
        "evaluationFoldCount": len(splits),
        "realDataRequired": True,
    }
    (output_dir / "training_summary.json").write_text(
        json.dumps(training_summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    import matplotlib

    matplotlib.use("Agg")
    from matplotlib import pyplot as plt

    selected_matrix = results[selected_name]["sessionLevel"]["confusionMatrix"]
    figure, axis = plt.subplots(figsize=(7, 6))
    image = axis.imshow(selected_matrix, cmap="Blues")
    axis.set_xticks(range(len(APPROVED_LABELS)), APPROVED_LABELS, rotation=25, ha="right")
    axis.set_yticks(range(len(APPROVED_LABELS)), APPROVED_LABELS)
    axis.set_xlabel("Predicted observable participation")
    axis.set_ylabel("Participant-provided label")
    axis.set_title(f"Session-level confusion matrix: {selected_name}")
    for row, values in enumerate(selected_matrix):
        for column, value in enumerate(values):
            axis.text(column, row, str(value), ha="center", va="center")
    figure.colorbar(image, ax=axis)
    figure.tight_layout()
    figure.savefig(output_dir / "confusion_matrix.png", dpi=150)
    plt.close(figure)
    return metrics
