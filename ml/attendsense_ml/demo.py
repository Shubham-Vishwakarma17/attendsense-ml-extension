"""Deterministic, explicitly synthetic Checkpoint 2A demo export generation."""

from __future__ import annotations

import csv
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from .data import APPROVED_LABELS, CSV_COLUMNS

DEMO_WARNING = (
    "Synthetic demo data. Not collected from real participants and not evidence of real-world accuracy."
)


def _sample_values(label: str, sample_index: int, randomizer: random.Random):
    if label == "active_participation":
        recently_interacted = randomizer.random() < 0.82
        return {
            "tabVisible": randomizer.random() < 0.93,
            "windowFocused": randomizer.random() < 0.88,
            "idleSeconds": randomizer.uniform(0.5, 8.0) if recently_interacted else randomizer.uniform(9.0, 25.0),
            "recentlyInteracted": recently_interacted,
        }
    if label == "passive_listening":
        return {
            "tabVisible": randomizer.random() < 0.94,
            "windowFocused": randomizer.random() < 0.86,
            "idleSeconds": max(0.0, 20.0 + sample_index * 13.0 + randomizer.uniform(-6.0, 10.0)),
            "recentlyInteracted": randomizer.random() < 0.18,
        }
    return {
        "tabVisible": randomizer.random() < 0.14,
        "windowFocused": randomizer.random() < 0.10,
        "idleSeconds": 120.0 + sample_index * 30.0 + randomizer.uniform(0.0, 55.0),
        "recentlyInteracted": randomizer.random() < 0.04,
    }


def generate_demo_data(
    output_dir: str | Path,
    *,
    sessions_per_class: int = 5,
    samples_per_session: int = 6,
    seed: int = 42,
) -> dict[str, object]:
    if sessions_per_class < 1 or samples_per_session < 1:
        raise ValueError("sessions-per-class and samples-per-session must be positive integers.")
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    randomizer = random.Random(seed)
    expected_paths: set[Path] = set()

    for label in APPROVED_LABELS:
        for session_number in range(1, sessions_per_class + 1):
            session_id = f"demo-{label}-{session_number:03d}"
            destination = output_path / f"{session_id}.csv"
            expected_paths.add(destination)
            with destination.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS)
                writer.writeheader()
                for sample_index in range(samples_per_session):
                    values = _sample_values(label, sample_index, randomizer)
                    writer.writerow({
                        "schemaVersion": 1,
                        "sessionId": session_id,
                        "sampleIndex": sample_index,
                        "elapsedSeconds": sample_index * 10,
                        "tabVisible": str(values["tabVisible"]).lower(),
                        "windowFocused": str(values["windowFocused"]).lower(),
                        "idleSeconds": f"{values['idleSeconds']:.3f}",
                        "recentlyInteracted": str(values["recentlyInteracted"]).lower(),
                        "facePresent": "",
                        "participationLabel": label,
                    })

    for stale_path in output_path.glob("demo-*.csv"):
        if stale_path not in expected_paths:
            stale_path.unlink()

    total_sessions = sessions_per_class * len(APPROVED_LABELS)
    metadata = {
        "datasetKind": "synthetic_demo",
        "generator": "ml/generate_demo_data.py",
        "randomSeed": seed,
        "sessionsPerClass": sessions_per_class,
        "samplesPerSession": samples_per_session,
        "totalSessions": total_sessions,
        "totalSamples": total_sessions * samples_per_session,
        "classLabels": list(APPROVED_LABELS),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "warning": DEMO_WARNING,
    }
    metadata_path = output_path.parent / "demo_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return metadata
