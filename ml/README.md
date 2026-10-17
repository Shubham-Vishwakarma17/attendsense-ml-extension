# AttendSense Offline ML Pipeline

This pipeline prepares privacy-safe Checkpoint 2A CSV exports, compares three multiclass classifiers with session-grouped cross-validation, saves the selected model, and performs offline prediction. It predicts an **observable browser participation state**, not attention, comprehension, learning, or attendance certainty.

No real training results are available until real participant-labelled sessions are collected. Tests use temporary synthetic fixtures only and must not be presented as project results.

## Synthetic end-to-end demonstration

The demo generator creates clearly named, deterministic synthetic sessions containing varied observable behavior patterns and no identity fields. Synthetic metrics only show that the software pipeline works; they do not estimate real-world performance.

```bash
python ml/generate_demo_data.py \
  --output-dir data/demo/raw \
  --sessions-per-class 5 \
  --samples-per-session 6 \
  --seed 42

python ml/prepare_dataset.py \
  --input-dir data/demo/raw \
  --output data/demo/processed/attendsense_demo_dataset.csv \
  --dataset-kind synthetic_demo

python ml/train.py \
  --dataset data/demo/processed/attendsense_demo_dataset.csv \
  --artifacts ml/demo_artifacts \
  --dataset-kind synthetic_demo

python ml/predict.py \
  --model ml/demo_artifacts/best_model.joblib \
  --input data/demo/raw/demo-active_participation-001.csv
```

These commands produce 15 synthetic sessions and 90 synthetic samples with the default demonstration settings. Generated demo CSVs, metadata, processed data, models, metrics, and plots are ignored by Git. The generated `data/demo/demo_metadata.json` records provenance and prominently identifies the dataset as synthetic.

Do not combine demo sessions with participant-collected sessions. For genuine research data, omit `--dataset-kind` or specify `--dataset-kind real`, and follow the private data workflow below.

## Environment setup

Python 3.10 or later is required. From the repository root on macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r ml/requirements.txt
```

The `.venv` directory is ignored by Git.

## Private data placement

Place extension-generated CSV files anywhere under `data/raw/`. Nested directories are discovered recursively. Do not commit participant exports. The pipeline rejects unexpected columns, invalid labels or booleans, non-empty `facePresent`, invalid numeric values, multi-session export files, and conflicting duplicate samples.

Collect at least three independent sessions for each label before training; five or more sessions per label are recommended. Seek balanced, varied examples of:

- `active_participation`
- `passive_listening`
- `away_from_lecture`

Follow [the dataset protocol](../docs/DATASET_PROTOCOL.md). Never add names, emails, meeting codes or URLs, titles, browsing history, audio, video, or images.

## Prepare the dataset

```bash
python ml/prepare_dataset.py \
  --input-dir data/raw \
  --output data/processed/attendsense_dataset.csv \
  --dataset-kind real
```

Preparation validates every source file, reports rejected filenames and reasons, combines valid rows deterministically, removes exact duplicates by `sessionId` and `sampleIndex`, rejects conflicting duplicates, and writes both the combined CSV and `attendsense_dataset.summary.json`.

## Features and leakage prevention

Only four predictive features are used:

- `tabVisible`, encoded as 0/1
- `windowFocused`, encoded as 0/1
- `idleSeconds`, clipped to the inclusive range 0–3,600 seconds
- `recentlyInteracted`, encoded as 0/1

Logistic Regression scales these four numeric inputs with `StandardScaler` fitted independently inside each training fold. `sessionId`, schema version, sample index, elapsed time, participant label, and `facePresent` are excluded from prediction. `sessionId` is used only to keep every session wholly inside either training or validation for a fold. The participant label is the target and is read for optional comparison only after prediction.

## Train and evaluate

```bash
python ml/train.py \
  --dataset data/processed/attendsense_dataset.csv \
  --artifacts ml/artifacts \
  --dataset-kind real
```

Training requires at least three independent sessions per class. It uses deterministic `StratifiedGroupKFold`, compares scaled Logistic Regression, a depth-controlled Decision Tree, and a deterministic Random Forest, and selects by grouped cross-validated session-level macro F1. Both sample-level and session-level accuracy, macro precision, macro recall, macro F1, and confusion matrices are reported. If there are too few sessions, training stops without reporting misleading performance.

Generated, ignored artifacts:

- `best_model.joblib`: selected fitted estimator plus feature/class metadata
- `metrics.json`: dataset counts, grouped-CV configuration, all model metrics, selection information, and limitations
- `confusion_matrix.png`: selected model's held-out session-level confusion matrix
- `feature_summary.json`: included/excluded features and transformations
- `training_summary.json`: dataset and selected-model summary

## Offline prediction

```bash
python ml/predict.py \
  --model ml/artifacts/best_model.joblib \
  --input data/raw/example-session.csv
```

Prediction reuses the strict Checkpoint 2A schema validation, predicts every retained sample using only the four allowlisted features, averages sample probabilities, and prints one observable-participation prediction with per-class probabilities, sample count, and session ID. The participant-provided label may be shown after inference for comparison; it is never a model input.

## Tests

```bash
python -m unittest discover -s tests/python -p 'test_*.py' -v
python -m compileall -q ml tests/python
```

## Scientific limitations

- Session-level self-reported labels can be noisy and cannot express within-session behavior changes.
- Browser visibility, focus, interaction, and idle time are coarse signals, not evidence of attention or learning.
- Grouped evaluation prevents same-session leakage but does not guarantee generalization to new people, devices, courses, or environments.
- A minimum of three sessions per class only makes grouped evaluation technically possible; it does not make performance estimates stable. Five or more per class is recommended, and substantially more diverse data is preferable.
- No accuracy or confusion matrix should be claimed until the pipeline is run on genuine collected sessions.
