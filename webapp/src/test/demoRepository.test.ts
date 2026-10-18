import { describe, expect, it } from "vitest";
import { DemoRepository } from "../services/demoRepository";
import type { Submission } from "../types";

describe("demo repository authorization boundaries", () => {
  it("separates teacher-owned and student-assigned lecture queries", async () => {
    const repository = new DemoRepository();
    const teacher = await repository.login("teacher@demo.local");
    let teacherCount = 0;
    const stopTeacher = repository.subscribeTeacherLectures(teacher.uid, (items) => { teacherCount = items.length; });
    expect(teacherCount).toBe(1);
    let assignedCount = 0;
    const stopStudent = repository.subscribeStudentLectures("nobody@example.com", (items) => { assignedCount = items.length; });
    expect(assignedCount).toBe(0);
    stopTeacher(); stopStudent();
  });

  it("rejects a submission for another identity", async () => {
    const repository = new DemoRepository();
    const student = await repository.login("student@demo.local");
    const forged = { studentUid: "someone-else", studentEmail: student.normalizedEmail } as Submission;
    await expect(repository.saveOwnSubmission("demo-lecture", student, forged)).rejects.toThrow(/own session/);
  });

  it("lets a teacher observe every submission for one lecture", () => {
    const repository = new DemoRepository();
    let submissions: Submission[] = [];
    const stop = repository.subscribeToLectureSubmissions("demo-lecture", (items) => { submissions = items; });
    expect(submissions).toHaveLength(1);
    expect(submissions[0].studentUid).toBe("demo-student-2");
    stop();
  });

  it("returns null for a missing own submission and never exposes another student's record", () => {
    const repository = new DemoRepository();
    let ownSubmission: Submission | null | undefined;
    const stop = repository.subscribeToStudentSubmission("demo-lecture", "demo-student-1", (item) => { ownSubmission = item; });
    expect(ownSubmission).toBeNull();
    stop();
  });

  it("keeps own-submission creation and replacement real-time and identity-scoped", async () => {
    const repository = new DemoRepository();
    const student = await repository.login("student@demo.local");
    let seed: Submission | undefined;
    const stopTeacherSeed = repository.subscribeToLectureSubmissions("demo-lecture", (items) => { seed = items[0]; });
    stopTeacherSeed();
    expect(seed).toBeDefined();

    let own: Submission | null = null;
    let other: Submission | null = null;
    let teacherItems: Submission[] = [];
    const stopOwn = repository.subscribeToStudentSubmission("demo-lecture", student.uid, (item) => { own = item; });
    const stopOther = repository.subscribeToStudentSubmission("demo-lecture", "demo-student-2", (item) => { other = item; });
    const stopTeacher = repository.subscribeToLectureSubmissions("demo-lecture", (items) => { teacherItems = items; });

    const created: Submission = {
      ...seed!, studentUid: student.uid, studentName: student.name,
      studentEmail: student.normalizedEmail, sessionId: "student-one-session",
      predictedParticipationLabel: "active_participation"
    };
    await repository.saveOwnSubmission("demo-lecture", student, created);
    expect((own as Submission | null)?.sessionId).toBe("student-one-session");
    expect((other as Submission | null)?.studentUid).toBe("demo-student-2");
    expect(teacherItems).toHaveLength(2);

    await repository.saveOwnSubmission("demo-lecture", student, { ...created, sessionId: "replacement-session" });
    expect((own as Submission | null)?.sessionId).toBe("replacement-session");
    expect(teacherItems).toHaveLength(2);
    stopOwn(); stopOther(); stopTeacher();
  });

  it("unsubscribes listeners cleanly", () => {
    const repository = new DemoRepository();
    let calls = 0;
    const stop = repository.subscribeStudentLectures("student@demo.local", () => { calls += 1; });
    stop();
    expect(calls).toBe(1);
  });
});
