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

## Privacy and file handling

Do not collect or add participant names, email addresses, Google Meet codes, meeting URLs, tab titles, browsing history, audio, video, photos, or camera images. Checkpoint 2A exports only allowlisted session timing, observable browser signals, and the participant-provided label. Export uses a local browser download and sends nothing to a server.

Dataset files must remain private and untracked. The repository ignores CSV, TSV, Parquet, JSONL, and the contents of `data/`. Store JSON exports under `data/` so they are also ignored; do not commit raw research exports.

## Limitations and label noise

- One label for an entire session cannot represent transitions between active, passive, and away behavior.
- Self-reported labels can be mistaken, inconsistent, or influenced by memory and expectations.
- Tab visibility, window focus, idle time, and page interaction are coarse browser observations and do not establish attention or learning.
- Opening the popup can affect window-focus and pointer-interaction signals.
- Timer throttling can create irregular sample spacing.
- Only the newest 2,160 samples are retained, approximately six hours at the nominal ten-second interval.
- Later model development must document class balance, collection conditions, preprocessing, uncertainty, and evaluation limitations.
