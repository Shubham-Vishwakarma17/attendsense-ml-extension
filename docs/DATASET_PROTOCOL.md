# AttendSense Dataset Protocol

## Scientific boundary

AttendSense is intended to model observable participation states. It does not detect attention, learning, comprehension, intent, or thoughts. Checkpoint 2A performs no prediction: it only lets a participant label and locally export a completed session.

## Participant-provided labels

Exactly one ground-truth label applies to the entire retained session:

- `active_participation`: the participant intentionally interacted with the lecture, for example by speaking, responding, taking relevant actions, or contributing through the lecture interface.
- `passive_listening`: the participant intentionally followed the lecture mainly by listening or watching, with little browser interaction.
- `away_from_lecture`: the participant was substantially away from or not participating in the lecture during the session.

The participant selects what they actually did. AttendSense does not infer or predict this label. A single session-level label is coarse and may not describe changes in behavior within the session.

## Recommended controlled collection

1. Decide before each session which of the three behaviors will be performed.
2. Use a comparable Meet setup, session length, device, and browser conditions across examples when practical.
3. Start AttendSense explicitly, perform the selected behavior, and stop the session normally.
4. Select the label honestly after the stopped session has at least one sample.
5. Export CSV or JSON locally and keep a separate private research log if experimental context is required.
6. Collect balanced numbers and varied examples of all three labels to reduce class imbalance and device-specific bias.
7. Review exported rows for technical validity before later preprocessing. Do not relabel examples merely to fit expected signals.

At least three independent sessions per label are required for the grouped evaluation pipeline. Five or more sessions per label are recommended; more diverse sessions provide a more credible evaluation.

## Privacy and file handling

Do not collect or add participant names, email addresses, Google Meet codes, meeting URLs, tab titles, browsing history, audio, video, photos, or camera images to dataset exports. Checkpoint 2A export itself uses a local browser download and sends nothing to a server. In the optional Checkpoint 3 workflow, the participant explicitly selects a JSON export; the portal rejects unknown fields, runs inference locally, and submits only the allowlisted signals, summary, and prediction metadata to the assigned lecture in Firestore. It does not store the original file as a blob.

Dataset files must remain private and untracked. The repository ignores CSV, TSV, Parquet, JSONL, and the contents of `data/`. Store JSON exports under `data/` so they are also ignored; do not commit raw research exports.

## Synthetic demonstration data

`ml/generate_demo_data.py` may be used to validate the preparation, training, artifact, and prediction software before real sessions are available. It generates clearly identified `demo-` sessions with deterministic, noisy behavior patterns and writes explicit provenance metadata. Preparation and training of these files must use `--dataset-kind synthetic_demo`.

Synthetic demo data is not participant data. Synthetic cross-validation metrics are not evidence of real-world accuracy and must never be mixed with or reported as results from genuine collection. Real participant evaluation remains future work until balanced, consent-based exports have been collected.

## Limitations and label noise

- One label for an entire session cannot represent transitions between active, passive, and away behavior.
- Self-reported labels can be mistaken, inconsistent, or influenced by memory and expectations.
- Tab visibility, window focus, idle time, and page interaction are coarse browser observations and do not establish attention or learning.
- Opening the popup can affect window-focus and pointer-interaction signals.
- Timer throttling can create irregular sample spacing.
- Only the newest 2,160 samples are retained, approximately six hours at the nominal ten-second interval.
- Checkpoint 2B prevents samples from the same session appearing in both training and validation, but small grouped datasets can still produce unstable or non-generalizable results.
- Real training accuracy and confusion matrices are unavailable until genuine exported sessions are collected.
