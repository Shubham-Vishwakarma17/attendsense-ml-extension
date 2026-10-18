import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth";
import { Layout } from "../components/Layout";
import { LectureForm } from "../components/LectureForm";
import { useRepository } from "../services/repository";
import type { Lecture } from "../types";

export function TeacherDashboard() {
  const { profile } = useAuth(); const repository = useRepository(); const [lectures, setLectures] = useState<Lecture[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({});
  useEffect(() => profile ? repository.subscribeTeacherLectures(profile.uid, setLectures) : undefined, [profile, repository]);
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
    <section className="stats" aria-label="Lecture summary"><div><strong>{counts.total}</strong><span>Total lectures</span></div><div><strong>{counts.scheduled}</strong><span>Scheduled</span></div><div><strong>{counts.active}</strong><span>Active</span></div><div><strong>{counts.completed}</strong><span>Completed</span></div><div><strong>{counts.students}</strong><span>Assigned students</span></div><div><strong>{counts.submissions}</strong><span>Submissions</span></div></section>
    <div className="dashboard-grid"><LectureForm profile={profile} onCreate={(input) => repository.createLecture(input)} />
      <section className="card lecture-manager"><div className="section-heading"><div><p className="section-kicker">LECTURES</p><h2>Owned lectures</h2></div><span>{lectures.length} total</span></div>{lectures.length === 0 && <p>No lectures yet.</p>}{lectures.map((item) => <article className="lecture-row" key={item.id}>
        <div className="lecture-row-heading"><div><h3>{item.title}</h3><p>{new Date(item.scheduledAt).toLocaleString()} · {item.studentEmails.length} students</p></div><span className={`status ${item.status}`}>{item.status}</span></div>
        <div className="actions"><a className="button secondary" href={item.meetUrl} target="_blank" rel="noreferrer">Open Meet</a>
          <label className="inline-control"><span className="sr-only">Lecture status</span><select aria-label={`Status for ${item.title}`} value={item.status} onChange={(e) => repository.updateLecture(item.id, { status: e.target.value as Lecture["status"] })}><option>scheduled</option><option>active</option><option>completed</option></select></label>
          <Link className="button secondary" to={`/teacher/lectures/${encodeURIComponent(item.id)}/results`}>View results</Link>
          <button className="danger" onClick={() => window.confirm("Delete this lecture and its visible workflow?") && repository.deleteLecture(item.id)}>Delete</button></div>
        <details><summary>Assigned students ({item.studentEmails.length})</summary><ul>{item.studentEmails.map((email) => <li key={email}>{email}</li>)}</ul></details>
      </article>)}</section></div>
  </main></Layout>;
}
