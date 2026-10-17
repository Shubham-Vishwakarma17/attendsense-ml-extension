# AttendSense

AttendSense is a consent-based Chrome extension mini-project for estimating **observable participation signals** during online lectures. It does not detect thoughts, learning, understanding, or actual attention. Checkpoint 1 supports Google Meet and keeps all collected data local.

## Checkpoint 1 behavior

After the user explicitly starts a session from a Google Meet tab, the content script records one sample approximately every 10 seconds:

- `timestamp`
- `tabVisible`
- `windowFocused`
- `idleSeconds`
- `recentlyInteracted`
- `facePresent` (always `null` in this checkpoint)

The popup reports session status, elapsed duration, sample count, and percentages for visible-tab, focused-window, and recent-interaction samples. Stop ends collection. A second Start cannot create another session while one is active.

Sessions and samples are stored only in `chrome.storage.local`. No camera, microphone, browsing-history, backend, dataset training, or ML prediction is included.

Start first performs a readiness handshake with the Meet content script. If an extension reload has left an existing Meet page without the current content script, Start fails without replacing the previous session and asks the user to refresh Meet. Navigating or reloading the monitored tab, or closing it, automatically ends that session with a stored stop reason.

Session mutations are serialized in the service worker. Stored sessions have schema version `1` and retain at most 2,160 samples, preserving the newest samples. At the nominal ten-second interval, this supports approximately six hours before older samples roll off.

## Checkpoint 2A: research labels and local export

A stopped session with at least one sample can be assigned exactly one participant-provided label: `active_participation`, `passive_listening`, or `away_from_lecture`. This is ground truth selected by the participant, not a prediction. A labelled session can be downloaded locally as privacy-safe CSV or JSON; exports contain no identity or meeting metadata and are never uploaded. See [docs/DATASET_PROTOCOL.md](docs/DATASET_PROTOCOL.md) for label definitions and the controlled collection protocol.

## Structure

```text
extension/  Chrome Manifest V3 extension
  background/  Session persistence and message coordination
  content/     Google Meet activity collection
  lib/         Pure session and metric calculations
  popup/       Accessible controls and aggregate display
tests/      Node built-in unit tests and manifest validation
docs/       Scope and scientific/privacy boundary
ml/         Reserved for later checkpoints
data/       Reserved for local private data; contents are ignored
```

## Development and verification

Requires Node.js 20 or later. There are no package dependencies.

```bash
npm test
npm run check:syntax
npm run check:manifest
npm run check
```

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this repository's `extension/` directory.
5. Open a page under `https://meet.google.com/` and, if the tab was already open before installation/reload, refresh it once.
6. Open the AttendSense popup and select **Start Lecture Session**.
7. Interact with the Meet page, switch tabs, or change window focus. Reopen the popup after at least 10 seconds to see samples and aggregates.
8. Select **Stop Session** and confirm that duration and sample count stop changing.
9. Optional: open the extension service worker inspector or DevTools, then inspect `chrome.storage.local` to view the stored `attendSenseSession` object.

Chrome may display a site-access notice for Google Meet because the content script is restricted to that host. The extension requests only `activeTab` and `storage`; it does not request camera, microphone, history, or broad all-sites access.

## Known limitations

- Browser timers are approximate and may be throttled when a tab is heavily suspended.
- `document.hasFocus()` and page visibility are coarse browser signals, not evidence of attention.
- “Recently interacted” means an interaction occurred within the latest 10-second interval; pointer movement may count.
- Opening the extension popup can temporarily make the Meet document appear unfocused, and moving the pointer toward the popup can affect recent-interaction measurements.
- Only one session is retained; starting after a stopped session replaces the previous stored session.
- Reloading, navigating, or closing the monitored Meet tab automatically stops the session; a new session must be started after the page is ready.
- The in-memory mutation queue protects writes within one service-worker lifetime; browser termination can still interrupt an in-flight operation.
- No camera/face or head-direction feature and no ML component exists in Checkpoint 1.
