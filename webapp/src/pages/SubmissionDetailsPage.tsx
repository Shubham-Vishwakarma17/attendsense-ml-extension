import { Link, useParams } from "react-router-dom";
import { Layout } from "../components/Layout";
import { SubmissionDetailsContent } from "../components/TeacherResults";
import { useLectureSubmissions, useOwnedLecture } from "./teacherRouteData";

export function SubmissionDetailsPage() {
  const { lectureId, studentUid } = useParams();
  const owned = useOwnedLecture(lectureId);
  const results = useLectureSubmissions(lectureId, Boolean(owned.lecture));
  const submission = results.submissions.find((item) => item.studentUid === studentUid);
  const resultsPath = `/teacher/lectures/${encodeURIComponent(lectureId ?? "")}/results`;
  if (owned.loading) return <Layout><main className="page"><p role="status">Loading submission details…</p></main></Layout>;
  if (owned.error) return <Layout><main className="page"><Unavailable message={owned.error} /></main></Layout>;
  if (!owned.lecture) return <Layout><main className="page"><Unavailable message="This lecture was not found or you do not have access to it." /></main></Layout>;
  const lecture = owned.lecture;
  if (results.loading) return <Layout><main className="page"><p role="status">Loading submission details…</p></main></Layout>;
  if (results.error) return <Layout><main className="page"><Unavailable message={results.error} resultsPath={resultsPath} /></main></Layout>;
  if (!submission || !lecture.studentEmails.includes(submission.studentEmail)) return <Layout><main className="page"><Unavailable message="This submission is unavailable, pending, or unrelated to the selected lecture." resultsPath={resultsPath} /></main></Layout>;
  return <Layout><main className="page route-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/teacher">Teacher dashboard</Link><span aria-hidden="true">/</span><Link to={resultsPath}>{lecture.title}</Link><span aria-hidden="true">/</span><Link to={resultsPath}>Results</Link><span aria-hidden="true">/</span><strong>{submission.studentName}</strong></nav>
    <div className="route-heading"><div><p className="eyebrow">SUBMISSION DETAILS</p><h1>{submission.studentName}</h1><p className="page-intro">{submission.studentEmail} · {lecture.title}</p></div><Link className="button secondary" to={resultsPath}>Back to results</Link></div>
    <SubmissionDetailsContent submission={submission} />
  </main></Layout>;
}

function Unavailable({ message, resultsPath }: { message: string; resultsPath?: string }) {
  return <section className="card empty-state"><p className="eyebrow">UNAVAILABLE</p><h1>Submission unavailable</h1><p>{message}</p><Link className="button secondary" to={resultsPath ?? "/teacher"}>{resultsPath ? "Back to results" : "Back to dashboard"}</Link></section>;
}
