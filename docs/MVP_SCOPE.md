# AttendSense MVP Scope

## Scientific boundary

AttendSense estimates **observable browser participation signals** during a user-started Google Meet lecture. These signals cannot establish whether a student is thinking, learning, understanding, or paying attention. The product must never present them as proof of those internal states.

## Checkpoint 1 included

- Explicit Start and Stop controls in an accessible Chrome extension popup.
- Monitoring limited to `https://meet.google.com/*`.
- One local sample approximately every 10 seconds while the selected session is active.
- Timestamp, tab visibility, window focus, idle duration, recent keyboard/mouse interaction, and a `null` face-presence placeholder.
- Local-only session storage and descriptive aggregate percentages.
- Pure, unit-tested session and metric calculations.
- A content-script readiness handshake before Start is persisted.
- Automatic session stop when the monitored tab reloads, navigates, or closes.
- Versioned session records with serialized mutations and a 2,160-sample cap (approximately six hours at the nominal ten-second interval), preserving the newest samples.

## Explicitly excluded

- Camera, face, gaze, head-direction, microphone, photo, or video capture.
- Raw frame storage.
- ML training, inference, labels, predictions, or claims about attention.
- Backend services, network uploads, identity tracking, or cross-site browsing history.
- Instructor dashboards, grading, discipline, or automated high-impact decisions.

## Privacy principles

Monitoring starts only after the user chooses **Start Lecture Session**. It stops after **Stop Session** and ignores later telemetry. Data remains in `chrome.storage.local` on the user's browser. Checkpoint 1 requests only `activeTab`, `storage`, and the Google Meet host scope.

Tab visibility, window focus, and page interaction are coarse observable browser signals. Opening the extension popup can temporarily affect window-focus readings, and pointer movement toward the popup can affect recent-interaction readings. These signals do not prove attention or learning.

## Later checkpoints

Any camera-derived feature requires a separate explicit consent design, an on-device processing assessment, no raw-frame retention, and technical validation. ML work must use documented labels and uncertainty handling and must preserve the scientific boundary above.

## Checkpoint 2A research data workflow

After a stopped session has at least one sample, the participant may assign one session-level label: `active_participation`, `passive_listening`, or `away_from_lecture`. The label is participant-provided ground truth, not an AttendSense prediction. Labelled sessions can be downloaded locally as privacy-safe CSV or JSON files. No identity, meeting metadata, media, network upload, model training, or inference is included. See [DATASET_PROTOCOL.md](DATASET_PROTOCOL.md).

## Checkpoint 2B offline ML workflow

The local Python workflow validates private CSV exports, prepares a deterministic dataset, compares Logistic Regression, Decision Tree, and Random Forest with session-grouped cross-validation, and performs offline prediction. Predictive features are limited to tab visibility, window focus, idle seconds, and recent interaction. The result is an observable participation-state prediction, never proof of attention, understanding, learning, or attendance. Generated data and model artifacts remain private and ignored; no backend, network upload, browser inference, or dashboard is included.

An explicitly synthetic demo generator is included only to exercise the complete software pipeline before real data collection. Synthetic provenance and warnings propagate through preparation summaries, model artifacts, metrics, and predictions. Synthetic metrics do not measure real-world model performance; genuine consent-based evaluation remains future work.
