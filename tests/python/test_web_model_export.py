from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml"))

from export_web_model import export_web_model  # noqa: E402


class WebModelExportTests(unittest.TestCase):
    def make_bundle(self, path: Path, dataset_kind: str = "synthetic_demo") -> None:
        features = np.array([
            [1, 1, 1, 1], [1, 1, 30, 0], [0, 0, 300, 0],
            [1, 1, 2, 1], [1, 1, 40, 0], [0, 0, 250, 0],
        ])
        labels = np.array(["active_participation", "passive_listening", "away_from_lecture"] * 2)
        model = Pipeline([("scale", StandardScaler()), ("model", LogisticRegression(max_iter=500))])
        model.fit(features, labels)
        joblib.dump({
            "datasetKind": dataset_kind,
            "model": model,
            "featureColumns": ["tabVisible", "windowFocused", "idleSeconds", "recentlyInteracted"],
            "idleSecondsClipMax": 600,
            "privateTrainingRows": features,
        }, path)

    def test_exports_only_allowlisted_browser_fields(self):
        with tempfile.TemporaryDirectory() as directory:
            model_path = Path(directory) / "model.joblib"
            output_path = Path(directory) / "model.json"
            self.make_bundle(model_path)
            artifact = export_web_model(model_path, output_path)
            self.assertEqual(set(artifact), {
                "modelVersion", "modelType", "datasetKind", "warning", "classOrder",
                "featureOrder", "idleSecondsClip", "scalerMeans", "scalerScales",
                "coefficients", "intercepts", "predictionMeaning", "scientificBoundary",
            })
            serialized = output_path.read_text(encoding="utf-8")
            self.assertNotIn("privateTrainingRows", serialized)
            self.assertEqual(json.loads(serialized), artifact)

    def test_refuses_non_synthetic_model(self):
        with tempfile.TemporaryDirectory() as directory:
            model_path = Path(directory) / "model.joblib"
            self.make_bundle(model_path, dataset_kind="real")
            with self.assertRaisesRegex(ValueError, "synthetic demo model"):
                export_web_model(model_path, Path(directory) / "model.json")


if __name__ == "__main__":
    unittest.main()
