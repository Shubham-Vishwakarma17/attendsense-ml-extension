#!/usr/bin/env python3
"""Train and compare leakage-safe observable-participation classifiers."""

import argparse
import json
import sys

from attendsense_ml.data import DatasetValidationError, load_checkpoint_csv
from attendsense_ml.training import TrainingDataError, train_and_write_artifacts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", required=True)
    parser.add_argument("--artifacts", default="ml/artifacts")
    parser.add_argument("--dataset-kind", choices=["real", "synthetic_demo"], default="real")
    args = parser.parse_args()
    try:
        frame = load_checkpoint_csv(args.dataset, require_single_session=False)
        metrics = train_and_write_artifacts(
            frame, args.artifacts, dataset_kind=args.dataset_kind
        )
    except (DatasetValidationError, TrainingDataError, ValueError) as error:
        print(f"Training stopped: {error}", file=sys.stderr)
        return 1
    print(json.dumps({
        "selectedModel": metrics["selectedModel"],
        "selectionMetric": metrics["selectionMetric"],
        "artifactDirectory": args.artifacts,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
