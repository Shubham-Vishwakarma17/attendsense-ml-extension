#!/usr/bin/env python3
"""Export the safe coefficients of the synthetic Logistic Regression demo model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib

from attendsense_ml.data import SYNTHETIC_WARNING

MODEL_VERSION = "attendsense-synthetic-logreg-v1"
SCIENTIFIC_BOUNDARY = (
    "Observable participation prediction only; not proof of attention, comprehension, "
    "learning, identity, or attendance."
)


def export_web_model(model_path: str | Path, output_path: str | Path) -> dict[str, object]:
    bundle = joblib.load(model_path)
    if bundle.get("datasetKind") != "synthetic_demo":
        raise ValueError("Only the explicit synthetic demo model may be exported for Checkpoint 3.")
    pipeline = bundle.get("model")
    if not hasattr(pipeline, "named_steps") or set(pipeline.named_steps) != {"scale", "model"}:
        raise ValueError("Expected the selected scaled Logistic Regression pipeline.")
    scaler = pipeline.named_steps["scale"]
    classifier = pipeline.named_steps["model"]
    if classifier.__class__.__name__ != "LogisticRegression":
        raise ValueError("The browser export requires Logistic Regression to be selected.")

    artifact = {
        "modelVersion": MODEL_VERSION,
        "modelType": "multinomial_logistic_regression",
        "datasetKind": "synthetic_demo",
        "warning": SYNTHETIC_WARNING,
        "classOrder": classifier.classes_.tolist(),
        "featureOrder": bundle["featureColumns"],
        "idleSecondsClip": {"minimum": 0, "maximum": bundle["idleSecondsClipMax"]},
        "scalerMeans": scaler.mean_.tolist(),
        "scalerScales": scaler.scale_.tolist(),
        "coefficients": classifier.coef_.tolist(),
        "intercepts": classifier.intercept_.tolist(),
        "predictionMeaning": "observable browser participation state",
        "scientificBoundary": SCIENTIFIC_BOUNDARY,
    }
    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    return artifact


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    export_web_model(args.model, args.output)
    print(f"Exported safe browser model to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
