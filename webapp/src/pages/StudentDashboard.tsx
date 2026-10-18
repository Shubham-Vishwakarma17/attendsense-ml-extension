import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { participationLabel, PredictionBadge, ProbabilityBars } from "../components/ParticipationDisplay";
import { useAuth } from "../auth";
import { predictSession } from "../lib/inference";
import { calculateSummary, MAX_UPLOAD_BYTES, validateSessionExport } from "../lib/validation";
import { countLabel, statusLabel } from "../lib/presentation";
import { predictionDescription, PredictionMethodLink } from "../components/PredictionMethodInfo";
import { useRepository } from "../services/repository";
import type { Lecture, Prediction, Submission, ValidatedSession } from "../types";

function UploadPanel({ lecture }: { lecture: Lecture }) {
  const { profile } = useAuth(); const repository = useRepository();
  const [session, setSession] = useState<ValidatedSession | null>(null); const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [message, setMessage] = useState(""); const [existing, setExisting] = useState<Submission | null>(null);
  useEffect(() => profile ? repository.subscribeToStudentSubmission(lecture.id, profile.uid, setExisting, () => setMessage("Could not load your current submission. Please try again.")) : undefined, [repository, lecture.id, profile]);
  async function readFile(file?: File) {
    setMessage(""); setSession(null); setPrediction(null);
    try {
      if (!file || !file.name.toLowerCase().endsWith(".json")) throw new Error("Choose an AttendSense .json export.");
      if (file.size > MAX_UPLOAD_BYTES) throw new Error("The session file exceeds the 2 MB limit.");
      const parsed = JSON.parse(await file.text()) as unknown;
      const validated = validateSessionExport(parsed); const inferred = predictSession(validated.samples);
      setSession(validated); setPrediction(inferred); setMessage("Session validated locally. Review before submitting.");
    } catch (error) { setMessage(error instanceof SyntaxError ? "This file is not valid JSON." : error instanceof Error ? error.message : "Could not validate the file."); }
  }
  async function submit() {
    if (!profile || !session || !prediction) return;
    if (existing && !window.confirm("Replace your existing submission?")) return;
    const summary = calculateSummary(session); const now = Date.now();
    const submission: Submission = {
      studentUid: profile.uid, studentName: profile.name, studentEmail: profile.normalizedEmail,
      sessionId: session.sessionId, sessionSchemaVersion: session.sessionSchemaVersion,
      startedAt: session.startedAt, stoppedAt: session.stoppedAt, stopReason: session.stopReason,
      ...summary, predictedParticipationLabel: prediction.predictedParticipationLabel,
      classProbabilities: prediction.classProbabilities, predictionType: prediction.predictionType,
      modelVersion: prediction.modelVersion, datasetKind: prediction.datasetKind,
      scientificBoundary: prediction.scientificBoundary,
      participantProvidedLabel: session.participationLabel, samples: session.samples,
      submittedAt: existing?.submittedAt ?? now, updatedAt: now
    };
    try { await repository.saveOwnSubmission(lecture.id, profile, submission); setMessage("Submission saved. Your teacher view can now update in real time."); }
    catch { setMessage("Could not save your submission. Please try again."); }
  }
  return <div className="upload-panel"><label>Upload AttendSense JSON<input aria-label={`Upload session for ${lecture.title}`} type="file" accept=".json,application/json" onChange={(e) => void readFile(e.target.files?.[0])} /></label>
    <p className="upload-message" role="status">{message}</p>{existing && <div className="existing-submission"><span className="submission-badge submitted">Submitted</span><span>Current result: <PredictionBadge label={existing.predictedParticipationLabel} /></span></div>}
    {session && prediction && <div className="review"><div className="section-heading"><div><p className="section-kicker">LOCAL REVIEW</p><h4>Review prediction before submitting</h4></div></div>
      <div className="review-summary"><div><span>Session</span><strong>{countLabel(session.sampleCount, "sample")} · {session.durationSeconds}s</strong></div><div><span>Participant label</span><strong>{participationLabel(session.participationLabel)}</strong></div><div><span>Predicted participation</span><PredictionBadge label={prediction.predictedParticipationLabel} /></div></div>
      <ProbabilityBars probabilities={prediction.classProbabilities} />
      <p className="prediction-description">{predictionDescription} <PredictionMethodLink /></p>
      <button onClick={() => void submit()}>{existing ? "Replace submission" : "Submit to teacher"}</button></div>}
  </div>;
}

export function StudentDashboard() {
  const { profile } = useAuth(); const repository = useRepository(); const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => profile ? repository.subscribeStudentLectures(profile.normalizedEmail, (items) => { setLectures(items); setLoading(false); setError(""); }, () => { setLoading(false); setError("Could not load your assigned lectures. Please try again."); }) : undefined, [profile, repository]);
  if (!profile) return null;
  return <Layout><main className="page"><p className="eyebrow">STUDENT DASHBOARD</p><h1>Your assigned lectures</h1><p className="page-intro">Join your lecture, collect your own session, and choose exactly what to submit.</p>
    <section className="privacy card"><h2>You control every submission</h2><p>No camera, microphone, audio, video, or browsing history is collected. Only the AttendSense session JSON you explicitly select is validated and submitted.</p></section>
    <div className="lecture-grid" aria-busy={loading}>{loading && <p role="status">Loading your assigned lectures…</p>}{error && <p className="form-error" role="alert">{error}</p>}{lectures.map((lecture) => <article className="card student-lecture" key={lecture.id}><div className="student-lecture-heading"><span className={`status ${lecture.status}`}>{statusLabel(lecture.status)}</span><h2>{lecture.title}</h2><p>{lecture.description}</p><p className="lecture-meta">{new Date(lecture.scheduledAt).toLocaleString()} · {lecture.teacherName}</p></div>
      <a className="button" href={lecture.meetUrl} target="_blank" rel="noreferrer">Join Google Meet</a>
      <p className="instruction">After Meet opens, click the AttendSense extension and select Start Lecture Session. The website cannot start the extension automatically.</p>
      <ol><li>Start the extension after joining Meet.</li><li>Stop it after the lecture.</li><li>Apply a research label and export JSON.</li><li>Upload the JSON here.</li></ol>
      <UploadPanel lecture={lecture} /></article>)}{!loading && !error && lectures.length === 0 && <section className="card empty-state"><h2>No assigned lectures</h2><p>Lectures assigned to your email will appear here.</p></section>}</div>
  </main></Layout>;
}
