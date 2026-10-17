#!/usr/bin/env python3
"""Run local inference for one validated AttendSense CSV export."""

import argparse
import json
import sys

import joblib

from attendsense_ml.data import DatasetValidationError, load_checkpoint_csv
from attendsense_ml.prediction import predict_observable_participation


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True)
    parser.add_argument("--input", required=True)
    args = parser.parse_args()
    try:
        bundle = joblib.load(args.model)
        frame = load_checkpoint_csv(args.input)
        result = predict_observable_participation(bundle, frame)
    except (DatasetValidationError, ValueError, OSError) as error:
        print(f"Prediction stopped: {error}", file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
