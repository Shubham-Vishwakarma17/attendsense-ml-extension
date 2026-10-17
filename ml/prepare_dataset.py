#!/usr/bin/env python3
"""Combine validated, private AttendSense CSV exports deterministically."""

import argparse
import json
import sys

from attendsense_ml.data import DatasetValidationError, prepare_dataset, write_prepared_dataset


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--dataset-kind", choices=["real", "synthetic_demo"], default="real")
    args = parser.parse_args()
    try:
        frame, summary, rejected = prepare_dataset(args.input_dir, dataset_kind=args.dataset_kind)
        summary_path = write_prepared_dataset(frame, summary, args.output)
    except DatasetValidationError as error:
        print(f"Dataset preparation failed: {error}", file=sys.stderr)
        return 1
    for error in rejected:
        print(f"Rejected: {error}", file=sys.stderr)
    print(json.dumps({**summary, "summaryFile": str(summary_path)}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
