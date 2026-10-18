# AttendSense web app

This React/TypeScript/Vite portal demonstrates the consent-based teacher/student workflow. It supports an explicit local demo repository or Firebase Authentication and Cloud Firestore. It never starts the extension automatically.

## Local demo

```bash
cp .env.example .env
# Set VITE_DEMO_MODE=true in .env
npm install
npm run dev
```

Use `teacher@demo.local` for the teacher view and `student@demo.local` for the student view; any password is accepted only by the in-memory demo repository. The banner makes this behavior visible. Demo data is never mixed with Firestore.

## Firebase mode

Copy `.env.example` to the ignored `.env`, set the six public Firebase web configuration values, and leave `VITE_DEMO_MODE=false`. Follow [../docs/FIREBASE_SETUP.md](../docs/FIREBASE_SETUP.md) before running the app.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

The checked-in browser model is a safe coefficient-only export trained on synthetic demo data. Predictions are observable participation states and are not evidence of attention or learning.
