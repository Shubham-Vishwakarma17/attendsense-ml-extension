# Checkpoint 3 demo runbook

1. In `webapp/.env`, explicitly set `VITE_DEMO_MODE=true`, then run `npm install` and `npm run dev` from `webapp/`.
2. Log in as `teacher@demo.local` with any password. Point out the persistent **DEMO MODE** and synthetic-model warnings.
3. Inspect the seeded lecture/results or create a lecture with an HTTPS `meet.google.com` URL and assigned student email.
4. Log out and log in as `student@demo.local` with any password.
5. Open the assigned lecture and select **Join Google Meet**.
6. After Meet opens, manually open AttendSense and select **Start Lecture Session**. Explain that the website cannot start the extension.
7. After samples are collected, manually stop the extension, choose a research label, and export JSON.
8. Return to the student portal, select that JSON, and review the locally validated summary and synthetic browser prediction.
9. Submit it. The demo repository replaces only that student's own record.
10. Log back in as the teacher and open results to show the updated submission.

The model output demonstrates software integration only. It is not evidence of attention, learning, identity, attendance, or real-world predictive accuracy. The demo repository is in memory, accepts any password, and resets on page reload.
