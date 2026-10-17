"""Strict ingestion and deterministic preparation of Checkpoint 2A CSV exports."""

from __future__ import annotations

import json
import math
from collections import Counter
from pathlib import Path

import pandas as pd

CSV_COLUMNS = (
    "schemaVersion",
    "sessionId",
    "sampleIndex",
    "elapsedSeconds",
    "tabVisible",
    "windowFocused",
    "idleSeconds",
    "recentlyInteracted",
    "facePresent",
    "participationLabel",
)
FEATURE_COLUMNS = ("tabVisible", "windowFocused", "idleSeconds", "recentlyInteracted")
APPROVED_LABELS = (
    "active_participation",
    "passive_listening",
    "away_from_lecture",
)
DATASET_KINDS = ("real", "synthetic_demo")
SYNTHETIC_WARNING = (
    "Synthetic demo results validate the software pipeline only. "
    "They do not measure real-world model performance."
)
BOOLEAN_COLUMNS = ("tabVisible", "windowFocused", "recentlyInteracted")


class DatasetValidationError(ValueError):
    """Raised when an input cannot safely be treated as an AttendSense export."""


def _strict_boolean(value: str, *, filename: Path, column: str, row_number: int) -> bool:
    if value == "true":
        return True
    if value == "false":
        return False
    raise DatasetValidationError(
        f"{filename}: row {row_number}: {column} must be exactly 'true' or 'false'."
    )


def _nonnegative_number(value: str, *, filename: Path, column: str, row_number: int) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise DatasetValidationError(
            f"{filename}: row {row_number}: {column} must be numeric."
        ) from error
    if not math.isfinite(result) or result < 0:
        raise DatasetValidationError(
            f"{filename}: row {row_number}: {column} must be finite and non-negative."
        )
    return result


def _nonnegative_integer(value: str, *, filename: Path, column: str, row_number: int) -> int:
    if not value.isdigit():
        raise DatasetValidationError(
            f"{filename}: row {row_number}: {column} must be a non-negative integer."
        )
    return int(value)


def load_checkpoint_csv(path: str | Path, *, require_single_session: bool = True) -> pd.DataFrame:
    """Load one exact-schema export, returning normalized typed columns."""
    filename = Path(path)
    try:
        frame = pd.read_csv(filename, dtype=str, keep_default_na=False)
    except Exception as error:
        raise DatasetValidationError(f"{filename}: could not read CSV: {error}") from error

    actual_columns = tuple(frame.columns)
    if actual_columns != CSV_COLUMNS:
        raise DatasetValidationError(
            f"{filename}: invalid header. Expected {list(CSV_COLUMNS)}, got {list(actual_columns)}."
        )
    if frame.empty:
        raise DatasetValidationError(f"{filename}: export contains no samples.")

    normalized_rows: list[dict[str, object]] = []
    for offset, row in frame.iterrows():
        row_number = int(offset) + 2
        if row["schemaVersion"] != "1":
            raise DatasetValidationError(
                f"{filename}: row {row_number}: unsupported schemaVersion {row['schemaVersion']!r}."
            )
        if not row["sessionId"]:
            raise DatasetValidationError(f"{filename}: row {row_number}: sessionId is required.")
        if row["facePresent"] != "":
            raise DatasetValidationError(
                f"{filename}: row {row_number}: facePresent must be empty in Checkpoint 2B."
            )
        if row["participationLabel"] not in APPROVED_LABELS:
            raise DatasetValidationError(
                f"{filename}: row {row_number}: invalid participationLabel {row['participationLabel']!r}."
            )

        normalized_rows.append(
            {
                "schemaVersion": 1,
                "sessionId": row["sessionId"],
                "sampleIndex": _nonnegative_integer(
                    row["sampleIndex"], filename=filename, column="sampleIndex", row_number=row_number
                ),
                "elapsedSeconds": _nonnegative_number(
                    row["elapsedSeconds"], filename=filename, column="elapsedSeconds", row_number=row_number
                ),
                "tabVisible": _strict_boolean(
                    row["tabVisible"], filename=filename, column="tabVisible", row_number=row_number
                ),
                "windowFocused": _strict_boolean(
                    row["windowFocused"], filename=filename, column="windowFocused", row_number=row_number
                ),
                "idleSeconds": _nonnegative_number(
                    row["idleSeconds"], filename=filename, column="idleSeconds", row_number=row_number
                ),
                "recentlyInteracted": _strict_boolean(
                    row["recentlyInteracted"],
                    filename=filename,
                    column="recentlyInteracted",
                    row_number=row_number,
                ),
                "facePresent": "",
                "participationLabel": row["participationLabel"],
            }
        )

    normalized = pd.DataFrame(normalized_rows, columns=CSV_COLUMNS)
    if require_single_session and normalized["sessionId"].nunique() != 1:
        raise DatasetValidationError(f"{filename}: an extension export must contain exactly one sessionId.")
    if normalized.groupby("sessionId")["participationLabel"].nunique().gt(1).any():
        raise DatasetValidationError(f"{filename}: a session cannot contain multiple labels.")
    return normalized


def discover_csv_files(input_dir: str | Path) -> list[Path]:
    directory = Path(input_dir)
    if not directory.is_dir():
        raise DatasetValidationError(f"Input directory does not exist: {directory}")
    return sorted(directory.rglob("*.csv"), key=lambda path: path.relative_to(directory).as_posix())


def _deduplicate(frame: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    keys = ["sessionId", "sampleIndex"]
    conflicts: list[str] = []
    for key, group in frame.groupby(keys, sort=True, dropna=False):
        if len(group) > 1 and len(group.drop_duplicates()) > 1:
            conflicts.append(f"sessionId={key[0]!r}, sampleIndex={key[1]}")
    if conflicts:
        raise DatasetValidationError("Conflicting duplicate samples: " + "; ".join(conflicts))
    duplicate_count = int(frame.duplicated(subset=keys, keep="first").sum())
    return frame.drop_duplicates(subset=keys, keep="first"), duplicate_count


def validate_dataset_kind(dataset_kind: str) -> str:
    if dataset_kind not in DATASET_KINDS:
        raise DatasetValidationError(
            f"dataset kind must be one of {list(DATASET_KINDS)}, got {dataset_kind!r}."
        )
    return dataset_kind


def prepare_dataset(
    input_dir: str | Path, *, dataset_kind: str = "real"
) -> tuple[pd.DataFrame, dict[str, object], list[str]]:
    validate_dataset_kind(dataset_kind)
    files = discover_csv_files(input_dir)
    if not files:
        raise DatasetValidationError(f"No CSV exports found under {Path(input_dir)}.")

    valid_frames: list[pd.DataFrame] = []
    rejected: list[str] = []
    for path in files:
        try:
            valid_frames.append(load_checkpoint_csv(path))
        except DatasetValidationError as error:
            rejected.append(str(error))
    if not valid_frames:
        details = "\n".join(rejected)
        raise DatasetValidationError(f"No valid AttendSense CSV exports were found.\n{details}")

    combined = pd.concat(valid_frames, ignore_index=True)
    combined, duplicate_count = _deduplicate(combined)
    if combined.groupby("sessionId")["participationLabel"].nunique().gt(1).any():
        raise DatasetValidationError("A session has conflicting participation labels across source files.")
    combined = combined.sort_values(["sessionId", "sampleIndex"], kind="stable").reset_index(drop=True)

    sample_counts = Counter(combined["participationLabel"])
    session_labels = combined[["sessionId", "participationLabel"]].drop_duplicates()
    session_counts = Counter(session_labels["participationLabel"])
    summary: dict[str, object] = {
        "datasetKind": dataset_kind,
        "datasetWarning": SYNTHETIC_WARNING if dataset_kind == "synthetic_demo" else None,
        "sourceFileCount": len(files),
        "validSourceFileCount": len(valid_frames),
        "sessionCount": int(combined["sessionId"].nunique()),
        "sampleCount": len(combined),
        "samplesPerClass": {label: int(sample_counts[label]) for label in APPROVED_LABELS},
        "sessionsPerClass": {label: int(session_counts[label]) for label in APPROVED_LABELS},
        "duplicateCount": duplicate_count,
        "rejectedFileCount": len(rejected),
    }
    return combined, summary, rejected


def write_prepared_dataset(frame: pd.DataFrame, summary: dict[str, object], output: str | Path) -> Path:
    output_path = Path(output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    serialized = frame.copy(deep=True)
    for column in BOOLEAN_COLUMNS:
        serialized[column] = serialized[column].map({True: "true", False: "false"})
    serialized.to_csv(output_path, index=False, lineterminator="\n")
    summary_path = output_path.with_suffix(".summary.json")
    summary_path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary_path
