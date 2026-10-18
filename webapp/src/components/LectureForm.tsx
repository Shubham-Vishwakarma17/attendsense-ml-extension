import { useMemo, useState, type FormEvent } from "react";
import { parseStudentEmails, validateMeetUrl } from "../lib/validation";
import type { Lecture, UserProfile } from "../types";

export function LectureForm({ profile, onCreate }: { profile: UserProfile; onCreate: (lecture: Omit<Lecture, "id" | "createdAt" | "updatedAt">) => Promise<unknown> }) {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [meetUrl, setMeetUrl] = useState(""); const [scheduledAt, setScheduledAt] = useState("");
  const [studentText, setStudentText] = useState(""); const [message, setMessage] = useState("");
  const count = useMemo(() => { try { return parseStudentEmails(studentText).length; } catch { return 0; } }, [studentText]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onCreate({ title: title.trim(), description: description.trim(), meetUrl: validateMeetUrl(meetUrl),
        teacherId: profile.uid, teacherName: profile.name, studentEmails: parseStudentEmails(studentText),
        scheduledAt: new Date(scheduledAt).getTime(), status: "scheduled" });
      setTitle(""); setDescription(""); setMeetUrl(""); setScheduledAt(""); setStudentText(""); setMessage("Lecture created.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create lecture."); }
  }
  return <form className="card form-grid" onSubmit={submit}><h2>Create lecture</h2>
    <label>Lecture title<input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
    <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label>Google Meet URL<input type="url" value={meetUrl} onChange={(e) => setMeetUrl(e.target.value)} required /></label>
    <label>Scheduled date and time<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required /></label>
    <label>Student emails<textarea aria-describedby="student-count" value={studentText} onChange={(e) => setStudentText(e.target.value)} placeholder="student@example.com, another@example.com" required /></label>
    <p id="student-count">{count} valid unique student{count === 1 ? "" : "s"}</p>
    <button type="submit">Create lecture</button><p role="status">{message}</p>
  </form>;
}
