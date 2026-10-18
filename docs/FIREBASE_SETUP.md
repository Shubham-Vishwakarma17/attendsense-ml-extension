# Firebase setup

Checkpoint 3 uses Firebase Authentication, Cloud Firestore, and optional free-tier Hosting. It does not require Cloud Functions, Firebase Storage, a service account, or a paid plan. Do not commit `.env`, credentials, or private keys.

## Project setup

1. Create a Firebase project manually in Firebase Console.
2. Add a Web app and copy its public browser configuration values.
3. Enable Authentication → Sign-in method → Email/Password.
4. Create a Cloud Firestore database. Do not use permanently open test rules.
5. From `webapp/`, copy `.env.example` to `.env`, keep `VITE_DEMO_MODE=false`, and fill all `VITE_FIREBASE_*` values.
6. Install the Firebase CLI separately if desired, authenticate interactively, and select your project without committing `.firebaserc`. The tracked `.firebaserc.example` is only a placeholder.
7. Deploy `firestore.rules` and `firestore.indexes.json` only after reviewing and emulator-testing them. Hosting builds from `webapp/dist`.

For local emulators set `VITE_USE_FIREBASE_EMULATORS=true`, then start Authentication on port 9099 and Firestore on port 8080. This repository does not silently connect to emulators.

## Teacher provisioning

Public registration always creates a student. To provision a demo teacher:

1. Create the user in Authentication (or register once as a student).
2. In Firestore, create or edit `users/{uid}` with exactly `uid`, `name`, `normalizedEmail`, `role`, and `createdAt`.
3. Set `uid` to the Authentication UID, `normalizedEmail` to the lowercase Authentication email, `role` to `teacher`, and `createdAt` to a timestamp.
4. Never expose an administrator credential to the browser. The client cannot promote its own role under the supplied rules.

## Collections

- `users/{uid}` stores the authenticated profile and role.
- `lectures/{lectureId}` stores an owned lecture and normalized assigned email list.
- `lectures/{lectureId}/submissions/{studentUid}` stores one replaceable allowlisted submission per assigned student.

Security Rules are the authorization boundary. The UI's protected routes are usability controls, not a substitute for rules. Before using real student data, add and run emulator-backed allow/deny tests and establish consent, retention, deletion, and institutional governance procedures.

## Current validation limitation

This checkpoint includes restrictive rules and static configuration tests, but it does not install `firebase-tools` or the Rules Unit Testing library. Emulator-backed Security Rules tests therefore are not part of the automated suite yet. Treat the rules as demo-stage until their allow/deny cases have been exercised with the Firebase Emulator Suite.
