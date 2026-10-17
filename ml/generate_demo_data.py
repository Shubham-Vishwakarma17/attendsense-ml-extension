#!/usr/bin/env python3
"""Generate explicit synthetic demo CSVs for exercising the offline pipeline."""

import argparse
import json

from attendsense_ml.demo import generate_demo_data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--sessions-per-class", type=int, default=5)
    parser.add_argument("--samples-per-session", type=int, default=6)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    try:
        metadata = generate_demo_data(
            args.output_dir,
            sessions_per_class=args.sessions_per_class,
            samples_per_session=args.samples_per_session,
            seed=args.seed,
        )
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(metadata, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
