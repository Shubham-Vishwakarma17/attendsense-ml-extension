from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml"))

from attendsense_ml.data import (  # noqa: E402
    APPROVED_LABELS,
    CSV_COLUMNS,
    FEATURE_COLUMNS,
    DatasetValidationError,
    load_checkpoint_csv,
    prepare_dataset,
    write_prepared_dataset,
)
from attendsense_ml.demo import DEMO_WARNING, generate_demo_data  # noqa: E402
from attendsense_ml.prediction import predict_observable_participation  # noqa: E402
from attendsense_ml.training import (  # noqa: E402
    TrainingDataError,
    feature_frame,
    grouped_splits,
    train_and_write_artifacts,
    validate_training_population,
)


def row(session_id="session-1", sample_index=0, label="active_participation", **overrides):
    values = {
        "schemaVersion": "1",
        "sessionId": session_id,
        "sampleIndex": str(sample_index),
        "elapsedSeconds": str(sample_index * 10),
        "tabVisible": "true",
        "windowFocused": "true",
        "idleSeconds": "1.5",
        "recentlyInteracted": "true",
        "facePresent": "",
        "participationLabel": label,
    }
    values.update(overrides)
    return values


def write_csv(path: Path, rows, columns=CSV_COLUMNS):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def synthetic_training_frame(samples_per_session=3):
    rows = []
    patterns = {
        "active_participation": (True, True, 1.0, True),
        "passive_listening": (True, True, 25.0, False),
        "away_from_lecture": (False, False, 300.0, False),
    }
    for label, pattern in patterns.items():
        for session_number in range(3):
            session_id = f"{label}-{session_number}"
            for sample_index in range(samples_per_session):
                rows.append({
                    "schemaVersion": 1,
                    "sessionId": session_id,
                    "sampleIndex": sample_index,
                    "elapsedSeconds": sample_index * 10.0,
                    "tabVisible": pattern[0],
                    "windowFocused": pattern[1],
                    "idleSeconds": pattern[2] + sample_index,
                    "recentlyInteracted": pattern[3],
                    "facePresent": "",
                    "participationLabel": label,
                })
    return pd.DataFrame(rows, columns=CSV_COLUMNS)


class DatasetPreparationTests(unittest.TestCase):
    def test_valid_csv_ingestion(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "valid.csv"
            write_csv(path, [row()])
            frame = load_checkpoint_csv(path)
            self.assertEqual(len(frame), 1)
            self.assertTrue(frame.iloc[0]["tabVisible"])

    def test_malformed_header_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad-header.csv"
            write_csv(path, [row()], columns=CSV_COLUMNS[:-1])
            with self.assertRaisesRegex(DatasetValidationError, "bad-header.csv: invalid header"):
                load_checkpoint_csv(path)

    def test_invalid_boolean_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad-boolean.csv"
            write_csv(path, [row(tabVisible="yes")])
            with self.assertRaisesRegex(DatasetValidationError, "tabVisible must be exactly"):
                load_checkpoint_csv(path)

    def test_invalid_label_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "bad-label.csv"
            write_csv(path, [row(label="attentive")])
            with self.assertRaisesRegex(DatasetValidationError, "invalid participationLabel"):
                load_checkpoint_csv(path)

    def test_nonempty_face_present_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "face.csv"
            write_csv(path, [row(facePresent="true")])
            with self.assertRaisesRegex(DatasetValidationError, "facePresent must be empty"):
                load_checkpoint_csv(path)

    def test_duplicate_removal_and_deterministic_order(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_csv(root / "z.csv", [row("z-session", 1), row("z-session", 1)])
            write_csv(root / "nested" / "a.csv", [row("a-session", 0)])
            frame, summary, rejected = prepare_dataset(root)
            self.assertEqual(list(zip(frame.sessionId, frame.sampleIndex)), [
                ("a-session", 0), ("z-session", 1)
            ])
            self.assertEqual(summary["duplicateCount"], 1)
            self.assertEqual(rejected, [])

    def test_conflicting_duplicate_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_csv(root / "one.csv", [row(idleSeconds="1")])
            write_csv(root / "two.csv", [row(idleSeconds="2")])
            with self.assertRaisesRegex(DatasetValidationError, "Conflicting duplicate"):
                prepare_dataset(root)

    def test_prepared_dataset_round_trips_through_strict_validation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "raw"
            write_csv(raw / "one.csv", [row()])
            frame, summary, _ = prepare_dataset(raw)
            output = root / "processed" / "combined.csv"
            write_prepared_dataset(frame, summary, output)
            reloaded = load_checkpoint_csv(output, require_single_session=False)
            self.assertEqual(len(reloaded), 1)
            self.assertIn("true", output.read_text(encoding="utf-8"))


class TrainingTests(unittest.TestCase):
    def test_feature_allowlist_excludes_group_and_label(self):
        frame = synthetic_training_frame()
        features = feature_frame(frame)
        self.assertEqual(tuple(features.columns), FEATURE_COLUMNS)
        self.assertNotIn("sessionId", features)
        self.assertNotIn("participationLabel", features)

    def test_group_separation(self):
        frame = synthetic_training_frame()
        for train_indices, validation_indices in grouped_splits(frame):
            training_sessions = set(frame.iloc[train_indices].sessionId)
            validation_sessions = set(frame.iloc[validation_indices].sessionId)
            self.assertTrue(training_sessions.isdisjoint(validation_sessions))

    def test_too_few_sessions_rejected(self):
        frame = synthetic_training_frame()
        frame = frame[frame.sessionId != "active_participation-2"]
        with self.assertRaisesRegex(TrainingDataError, "at least 3 independent sessions"):
            validate_training_population(frame)

    def test_successful_training_and_deterministic_selection(self):
        frame = synthetic_training_frame()
        with tempfile.TemporaryDirectory() as first, tempfile.TemporaryDirectory() as second:
            first_metrics = train_and_write_artifacts(frame, first)
            second_metrics = train_and_write_artifacts(frame, second)
            self.assertEqual(first_metrics["selectedModel"], second_metrics["selectedModel"])
            self.assertEqual(first_metrics["models"], second_metrics["models"])
            expected = {
                "best_model.joblib", "metrics.json", "confusion_matrix.png",
                "feature_summary.json", "training_summary.json",
            }
            self.assertEqual({path.name for path in Path(first).iterdir()}, expected)

    def test_prediction_schema_and_no_label_feature(self):
        frame = synthetic_training_frame()
        with tempfile.TemporaryDirectory() as directory:
            train_and_write_artifacts(frame, directory)
            bundle = joblib.load(Path(directory) / "best_model.joblib")
            session = frame[frame.sessionId == "active_participation-0"].copy()
            original_label = session["participationLabel"].copy()
            first = predict_observable_participation(bundle, session)
            session["participationLabel"] = "away_from_lecture"
            second = predict_observable_participation(bundle, session)
            self.assertEqual(first["predictedParticipationLabel"], second["predictedParticipationLabel"])
            self.assertEqual(first["classProbabilities"], second["classProbabilities"])
            self.assertEqual(set(first), {
                "predictionType", "datasetKind", "datasetWarning",
                "predictedParticipationLabel", "classProbabilities",
                "sampleCount", "sessionId", "participantLabel", "matchesParticipantLabel",
                "scientificBoundary",
            })
            self.assertEqual(set(first["classProbabilities"]), set(APPROVED_LABELS))
            self.assertEqual(original_label.iloc[0], first["participantLabel"])


class DemoWorkflowTests(unittest.TestCase):
    def test_generation_is_deterministic_for_rows_and_seed_sensitive(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            first = root / "first" / "raw"
            second = root / "second" / "raw"
            third = root / "third" / "raw"
            generate_demo_data(first, sessions_per_class=2, samples_per_session=3, seed=42)
            generate_demo_data(second, sessions_per_class=2, samples_per_session=3, seed=42)
            generate_demo_data(third, sessions_per_class=2, samples_per_session=3, seed=43)
            first_contents = [path.read_text() for path in sorted(first.glob("*.csv"))]
            second_contents = [path.read_text() for path in sorted(second.glob("*.csv"))]
            third_contents = [path.read_text() for path in sorted(third.glob("*.csv"))]
            self.assertEqual(first_contents, second_contents)
            self.assertNotEqual(first_contents, third_contents)

    def test_exact_balanced_private_demo_schema_and_counts(self):
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory) / "demo" / "raw"
            metadata = generate_demo_data(raw, sessions_per_class=5, samples_per_session=6, seed=42)
            paths = sorted(raw.glob("*.csv"))
            self.assertEqual(len(paths), 15)
            self.assertEqual(metadata["totalSessions"], 15)
            self.assertEqual(metadata["totalSamples"], 90)
            self.assertEqual(metadata["warning"], DEMO_WARNING)
            labels = []
            observed_feature_rows = set()
            forbidden = {"name", "email", "url", "meetCode", "title", "browsingHistory"}
            for path in paths:
                self.assertTrue(path.name.startswith("demo-"))
                with path.open(newline="", encoding="utf-8") as handle:
                    reader = csv.DictReader(handle)
                    self.assertEqual(tuple(reader.fieldnames), CSV_COLUMNS)
                    self.assertTrue(forbidden.isdisjoint(reader.fieldnames))
                    rows = list(reader)
                self.assertEqual(len(rows), 6)
                self.assertEqual([int(item["sampleIndex"]) for item in rows], list(range(6)))
                self.assertTrue(all(item["sessionId"].startswith("demo-") for item in rows))
                self.assertTrue(all(item["facePresent"] == "" for item in rows))
                self.assertEqual(len({item["participationLabel"] for item in rows}), 1)
                labels.append(rows[0]["participationLabel"])
                observed_feature_rows.update(
                    (item["tabVisible"], item["windowFocused"], item["idleSeconds"], item["recentlyInteracted"])
                    for item in rows
                )
            self.assertEqual({label: labels.count(label) for label in APPROVED_LABELS}, {
                label: 5 for label in APPROVED_LABELS
            })
            self.assertGreater(len(observed_feature_rows), 3)

    def test_synthetic_kind_propagates_to_summary_artifacts_and_model(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = root / "demo" / "raw"
            generate_demo_data(raw, sessions_per_class=3, samples_per_session=3, seed=42)
            frame, summary, rejected = prepare_dataset(raw, dataset_kind="synthetic_demo")
            self.assertEqual(rejected, [])
            self.assertEqual(summary["datasetKind"], "synthetic_demo")
            self.assertIn("software pipeline only", summary["datasetWarning"])
            artifacts = root / "artifacts"
            train_and_write_artifacts(frame, artifacts, dataset_kind="synthetic_demo")
            metrics = json.loads((artifacts / "metrics.json").read_text())
            training_summary = json.loads((artifacts / "training_summary.json").read_text())
            bundle = joblib.load(artifacts / "best_model.joblib")
            for payload in (metrics, training_summary, bundle):
                self.assertEqual(payload["datasetKind"], "synthetic_demo")
                self.assertIn("software pipeline only", payload["datasetWarning"])


if __name__ == "__main__":
    unittest.main()
