import { Link } from "react-router-dom";
import { participationLabel, PredictionBadge, ProbabilityBars } from "./ParticipationDisplay";
import type { Lecture, Submission } from "../types";

export function SubmissionStatus({ submitted }: { submitted: boolean }) {
  return <span className={`submission-badge ${submitted ? "submitted" : "pending"}`}>{submitted ? "Submitted" : "Pending"}</span>;
}

function StudentIdentity({ email, submission }: { email: string; submission?: Submission }) {
  return <div className="student-identity"><strong>{submission?.studentName ?? email}</strong>{submission && <small>{email}</small>}</div>;
}

function SessionTimeline({ submission }: { submission: Submission }) {
  const single = submission.samples.length === 1;
  const summary = `${submission.samples.length} recorded ${submission.samples.length === 1 ? "state" : "states"}. Tab visible ${submission.tabVisiblePercent.toFixed(1)} percent, window focused ${submission.windowFocusedPercent.toFixed(1)} percent, recent interaction ${submission.recentInteractionPercent.toFixed(1)} percent.`;
  return <section className="timeline-section" aria-labelledby="timeline-title">
    <div className="section-heading"><div><p className="section-kicker">SESSION SIGNALS</p><h2 id="timeline-title" className="subsection-title">Activity timeline</h2></div><span>{submission.samples.length} {submission.samples.length === 1 ? "sample" : "samples"}</span></div>
    <p className="timeline-summary">{summary}</p>
    <div className="timeline-legend" aria-label="Timeline legend"><span><i className="signal-dot visible" />Tab visible</span><span><i className="signal-dot focused" />Window focused</span><span><i className="signal-dot interaction" />Recent interaction</span><span><i className="idle-key" />Idle seconds</span></div>
    <div className={`timeline ${single ? "single-sample" : ""}`} aria-label="Session sample timeline">
      {submission.samples.map((sample) => <div className="timeline-sample" key={sample.sampleIndex} aria-label={`Sample ${sample.sampleIndex + 1} at ${sample.elapsedSeconds} seconds: tab ${sample.tabVisible ? "visible" : "not visible"}, window ${sample.windowFocused ? "focused" : "not focused"}, ${sample.recentlyInteracted ? "recent interaction" : "no recent interaction"}, idle ${sample.idleSeconds} seconds`}>
        <div className="idle-bar-wrap"><span className="idle-value">{sample.idleSeconds.toFixed(1)}s</span><span className="idle-bar" style={{ height: `${Math.min(84, 18 + sample.idleSeconds)}px` }} /></div>
        <div className="sample-signals"><i className={`signal-dot visible ${sample.tabVisible ? "on" : "off"}`} title={`Tab ${sample.tabVisible ? "visible" : "not visible"}`} /><i className={`signal-dot focused ${sample.windowFocused ? "on" : "off"}`} title={`Window ${sample.windowFocused ? "focused" : "not focused"}`} /><i className={`signal-dot interaction ${sample.recentlyInteracted ? "on" : "off"}`} title={sample.recentlyInteracted ? "Recent interaction" : "No recent interaction"} /></div>
        <span className="sample-time">{sample.elapsedSeconds}s</span>
      </div>)}
    </div>
  </section>;
}

export function SubmissionDetailsContent({ submission }: { submission: Submission }) {
  const confidence = Math.max(...Object.values(submission.classProbabilities));
  const metrics = [
    ["Confidence", `${(confidence * 100).toFixed(1)}%`], ["Duration", `${submission.durationSeconds}s`],
    ["Samples", String(submission.sampleCount)], ["Tab visible", `${submission.tabVisiblePercent.toFixed(1)}%`],
    ["Window focused", `${submission.windowFocusedPercent.toFixed(1)}%`], ["Recent interaction", `${submission.recentInteractionPercent.toFixed(1)}%`],
    ["Mean idle", `${submission.meanIdleSeconds.toFixed(1)}s`]
  ];
  return <div className="detail standalone-detail">
    <div className="metric-grid detail-metrics">{metrics.map(([label, value]) => <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="result-comparison">
      <section><p className="section-kicker">PARTICIPANT-PROVIDED LABEL</p><strong>{participationLabel(submission.participantProvidedLabel)}</strong><p className="supporting-text">Self-reported after the lecture session.</p></section>
      <section><p className="section-kicker">MODEL PREDICTION</p><PredictionBadge label={submission.predictedParticipationLabel} /><p className="supporting-text">Synthetic demonstration model.</p></section>
    </div>
    <section className="probability-panel"><div className="section-heading"><div><p className="section-kicker">MODEL OUTPUT</p><h2 className="subsection-title">Class probabilities</h2></div></div><ProbabilityBars probabilities={submission.classProbabilities} /></section>
    <SessionTimeline submission={submission} />
    <p className="warning scientific-warning"><strong>Scientific boundary:</strong> {submission.scientificBoundary}</p>
  </div>;
}

export function ResultsList({ lecture, submissions }: { lecture: Lecture; submissions: Submission[] }) {
  const byEmail = new Map(submissions.map((item) => [item.studentEmail, item]));
  if (lecture.studentEmails.length === 0) return <div className="empty-state"><h2>No students assigned</h2><p>Add student emails to this lecture before collecting submissions.</p></div>;
  return <section className="card results-section"><div className="section-heading"><div><p className="section-kicker">LECTURE RESULTS</p><h2>Student submissions</h2><p>{submissions.length === 0 ? "No submissions received yet." : `${submissions.length} of ${lecture.studentEmails.length} submitted`}</p></div></div>
    <div className="table-wrap results-table"><table><thead><tr><th>Student</th><th>Status</th><th>Prediction</th><th>Confidence</th><th>Duration</th><th>Samples</th><th>Submitted</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{lecture.studentEmails.map((email) => { const item = byEmail.get(email); const confidence = item ? Math.max(...Object.values(item.classProbabilities)) : 0;
        return <tr key={email}><td><StudentIdentity email={email} submission={item} /></td><td><SubmissionStatus submitted={Boolean(item)} /></td>
          <td>{item ? <PredictionBadge label={item.predictedParticipationLabel} /> : "—"}</td><td>{item ? `${(confidence * 100).toFixed(1)}%` : "—"}</td>
          <td>{item ? `${item.durationSeconds}s` : "—"}</td><td>{item?.sampleCount ?? "—"}</td><td>{item ? new Date(item.submittedAt).toLocaleString() : "—"}</td>
          <td>{item && <Link className="button secondary compact" to={`/teacher/lectures/${encodeURIComponent(lecture.id)}/results/${encodeURIComponent(item.studentUid)}`}>Inspect submission</Link>}</td></tr>; })}</tbody></table></div>
    <div className="result-card-list" data-testid="mobile-result-cards">{lecture.studentEmails.map((email) => { const item = byEmail.get(email); const confidence = item ? Math.max(...Object.values(item.classProbabilities)) : 0;
      return <article className="result-card" key={email}><div className="result-card-header"><StudentIdentity email={email} submission={item} /><SubmissionStatus submitted={Boolean(item)} /></div>
        {item ? <><div className="result-card-prediction"><PredictionBadge label={item.predictedParticipationLabel} /><strong>{(confidence * 100).toFixed(1)}%</strong></div><dl><div><dt>Duration</dt><dd>{item.durationSeconds}s</dd></div><div><dt>Samples</dt><dd>{item.sampleCount}</dd></div><div><dt>Submitted</dt><dd>{new Date(item.submittedAt).toLocaleString()}</dd></div></dl><Link className="button secondary" to={`/teacher/lectures/${encodeURIComponent(lecture.id)}/results/${encodeURIComponent(item.studentUid)}`}>Inspect submission</Link></> : <p className="supporting-text">Waiting for this student’s session submission.</p>}
      </article>; })}</div>
  </section>;
}
