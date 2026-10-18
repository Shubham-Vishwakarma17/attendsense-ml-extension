import { Link, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { ResultsList } from "../components/TeacherResults";
import { useLectureSubmissions, useOwnedLecture } from "./teacherRouteData";
import { countLabel, statusLabel } from "../lib/presentation";

export function LectureResultsPage() {
  const { lectureId } = useParams();
  const owned = useOwnedLecture(lectureId);
  const results = useLectureSubmissions(lectureId, Boolean(owned.lecture));
  if (owned.loading) return <Layout><main className="page"><p role="status">Loading lecture results…</p></main></Layout>;
  if (owned.error) return <Layout><main className="page"><Unavailable title="Could not load lecture" message={owned.error} /></main></Layout>;
  if (!owned.lecture) return <Layout><main className="page"><Unavailable title="Lecture unavailable" message="This lecture was not found or you do not have access to it." /></main></Layout>;
  const lecture = owned.lecture;
  const assignedSubmissions = results.submissions.filter((item) => lecture.studentEmails.includes(item.studentEmail));
  return <Layout><main className="page route-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/teacher">Teacher dashboard</Link><span aria-hidden="true">/</span><span>{lecture.title}</span><span aria-hidden="true">/</span><strong>Results</strong></nav>
    <div className="route-heading"><div><p className="eyebrow">LECTURE RESULTS</p><h1>{lecture.title}</h1>{lecture.description && <p className="page-intro">{lecture.description}</p>}</div><Link className="button secondary" to="/teacher">Back to dashboard</Link></div>
    <section className="lecture-summary card" aria-label="Lecture information"><div><span>Teacher</span><strong>{lecture.teacherName}</strong></div><div><span>Scheduled</span><strong>{new Date(lecture.scheduledAt).toLocaleString()}</strong></div><div><span>Status</span><strong><span className={`status ${lecture.status}`}>{statusLabel(lecture.status)}</span></strong></div><div><span>Assigned</span><strong>{countLabel(lecture.studentEmails.length, "student")}</strong></div><div><span>Submitted</span><strong>{countLabel(assignedSubmissions.length, "result")}</strong></div><div><span>Pending</span><strong>{countLabel(Math.max(0, lecture.studentEmails.length - assignedSubmissions.length), "result")}</strong></div></section>
    <a className="button meet-action" href={lecture.meetUrl} target="_blank" rel="noreferrer">Open Google Meet</a>
    {results.loading ? <p role="status">Loading student submissions…</p> : results.error ? <Unavailable title="Could not load submissions" message={results.error} /> : <ResultsList lecture={lecture} submissions={assignedSubmissions} />}
  </main></Layout>;
}

function Unavailable({ title, message }: { title: string; message: string }) {
  return <section className="card empty-state"><p className="eyebrow">UNAVAILABLE</p><h1>{title}</h1><p>{message}</p><Link className="button secondary" to="/teacher">Back to dashboard</Link></section>;
}
