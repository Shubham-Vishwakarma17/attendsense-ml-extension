import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import { LectureForm } from "../components/LectureForm";
import { DeleteLectureDialog } from "../components/DeleteLectureDialog";
import { countLabel, statusLabel } from "../lib/presentation";
import { useRepository } from "../services/repository";
import type { Lecture } from "../types";

export function TeacherDashboard() {
  const { profile } = useAuth(); const repository = useRepository(); const [lectures, setLectures] = useState<Lecture[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ lecture: Lecture; button: HTMLElement | null } | null>(null);
  useEffect(() => profile ? repository.subscribeTeacherLectures(profile.uid, (items) => { setLectures(items); setLoading(false); setError(""); }, () => { setLoading(false); setError("Could not load your lectures. Please try again."); }) : undefined, [profile, repository]);
  useEffect(() => {
    setSubmissionCounts({});
    const unsubscribes = lectures.map((lecture) => repository.subscribeToLectureSubmissions(lecture.id, (items) => setSubmissionCounts((current) => ({ ...current, [lecture.id]: items.length }))));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [lectures, repository]);
  const counts = useMemo(() => ({
    total: lectures.length, scheduled: lectures.filter((item) => item.status === "scheduled").length,
    active: lectures.filter((item) => item.status === "active").length, completed: lectures.filter((item) => item.status === "completed").length,
    students: new Set(lectures.flatMap((item) => item.studentEmails)).size,
    submissions: Object.values(submissionCounts).reduce((total, count) => total + count, 0)
  }), [lectures, submissionCounts]);
  if (!profile) return null;
  return <Layout><main className="page"><div className="page-heading"><div><p className="eyebrow">TEACHER DASHBOARD</p><h1>Lecture overview</h1><p className="page-intro">Manage lectures and review observable participation submissions.</p></div></div>
    <section className="stats" aria-label="Lecture summary"><div><strong>{counts.total}</strong><span>{counts.total === 1 ? "Lecture" : "Lectures"}</span></div><div><strong>{counts.scheduled}</strong><span>Scheduled</span></div><div><strong>{counts.active}</strong><span>Active</span></div><div><strong>{counts.completed}</strong><span>Completed</span></div><div><strong>{counts.students}</strong><span>{counts.students === 1 ? "Assigned student" : "Assigned students"}</span></div><div><strong>{counts.submissions}</strong><span>{counts.submissions === 1 ? "Submission" : "Submissions"}</span></div></section>
    <div className="dashboard-grid"><LectureForm profile={profile} onCreate={(input) => repository.createLecture(input)} />
      <section className="card lecture-manager" aria-busy={loading}><div className="section-heading"><div><p className="section-kicker">LECTURES</p><h2>Owned lectures</h2></div><span>{countLabel(lectures.length, "lecture")}</span></div>{loading && <p role="status">Loading your lectures…</p>}{error && <p className="form-error" role="alert">{error}</p>}{!loading && !error && lectures.length === 0 && <div className="empty-state compact-empty"><h3>No lectures yet</h3><p>Create your first lecture using the form.</p></div>}{lectures.map((item) => <article className="lecture-row" key={item.id}>
        <div className="lecture-row-heading"><div><h3>{item.title}</h3><p>{new Date(item.scheduledAt).toLocaleString()} · {countLabel(item.studentEmails.length, "student")}</p></div><span className={`status ${item.status}`}>{statusLabel(item.status)}</span></div>
        <div className="actions"><a className="button secondary" href={item.meetUrl} target="_blank" rel="noreferrer">Open Meet</a>
          <label className="inline-control"><span className="sr-only">Lecture status</span><select aria-label={`Status for ${item.title}`} value={item.status} onChange={(e) => repository.updateLecture(item.id, { status: e.target.value as Lecture["status"] })}><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="completed">Completed</option></select></label>
          <Link className="button secondary" to={`/teacher/lectures/${encodeURIComponent(item.id)}/results`}>View results</Link>
          <button className="danger" onClick={(event) => setDeleteTarget({ lecture: item, button: event.currentTarget })}>Delete</button></div>
        <details><summary>Assigned ({countLabel(item.studentEmails.length, "student")})</summary><ul>{item.studentEmails.map((email) => <li key={email}>{email}</li>)}</ul></details>
      </article>)}</section></div>
    {deleteTarget && <DeleteLectureDialog lectureTitle={deleteTarget.lecture.title} returnFocus={deleteTarget.button} onCancel={() => setDeleteTarget(null)} onConfirm={async () => { await repository.deleteLecture(deleteTarget.lecture.id); setDeleteTarget(null); }} />}
  </main></Layout>;
}
