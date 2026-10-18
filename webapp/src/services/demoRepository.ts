import type { Lecture, PlatformRepository, Submission, Unsubscribe, UserProfile } from "../types";

const TEACHER: UserProfile = {
  uid: "demo-teacher", name: "Dr. Asha Mehta", normalizedEmail: "teacher@demo.local",
  role: "teacher", createdAt: 1
};
const STUDENTS: UserProfile[] = [
  { uid: "demo-student-1", name: "Aarav Student", normalizedEmail: "student@demo.local", role: "student", createdAt: 2 },
  { uid: "demo-student-2", name: "Mira Student", normalizedEmail: "mira@demo.local", role: "student", createdAt: 3 },
  { uid: "demo-student-3", name: "Kabir Student", normalizedEmail: "kabir@demo.local", role: "student", createdAt: 4 }
];
const lecture: Lecture = {
  id: "demo-lecture", title: "Machine Learning Foundations",
  description: "Synthetic demo lecture for the AttendSense workflow.",
  meetUrl: "https://meet.google.com/demo-demo-demo", teacherId: TEACHER.uid,
  teacherName: TEACHER.name, studentEmails: STUDENTS.map((student) => student.normalizedEmail),
  scheduledAt: Date.now() + 3600000, status: "active", createdAt: Date.now(), updatedAt: Date.now()
};
const seedSubmission: Submission = {
  studentUid: STUDENTS[1].uid, studentName: STUDENTS[1].name, studentEmail: STUDENTS[1].normalizedEmail,
  sessionId: "demo-seeded-session", sessionSchemaVersion: 1, startedAt: Date.now() - 120000,
  stoppedAt: Date.now() - 60000, stopReason: "user", durationSeconds: 60, sampleCount: 2,
  tabVisiblePercent: 100, windowFocusedPercent: 100, recentInteractionPercent: 50, meanIdleSeconds: 12,
  predictedParticipationLabel: "passive_listening",
  classProbabilities: { active_participation: 0.12, passive_listening: 0.82, away_from_lecture: 0.06 },
  predictionType: "observable participation prediction", modelVersion: "attendsense-synthetic-logreg-v1",
  datasetKind: "synthetic_demo", scientificBoundary: "Synthetic sample data; not evidence of attention or learning.",
  participantProvidedLabel: "passive_listening",
  samples: [
    { sampleIndex: 0, elapsedSeconds: 10, tabVisible: true, windowFocused: true, idleSeconds: 7, recentlyInteracted: true, facePresent: null },
    { sampleIndex: 1, elapsedSeconds: 20, tabVisible: true, windowFocused: true, idleSeconds: 17, recentlyInteracted: false, facePresent: null }
  ], submittedAt: Date.now() - 50000, updatedAt: Date.now() - 50000
};

function clone<T>(value: T): T { return structuredClone(value); }

export class DemoRepository implements PlatformRepository {
  readonly mode = "demo" as const;
  private profile: UserProfile | null = null;
  private lectures: Lecture[] = [lecture];
  private submissions = new Map<string, Submission[]>([[lecture.id, [seedSubmission]]]);
  private authListeners = new Set<(profile: UserProfile | null) => void>();
  private lectureListeners = new Set<() => void>();
  private submissionListeners = new Set<() => void>();

  subscribeAuth(callback: (profile: UserProfile | null) => void): Unsubscribe {
    this.authListeners.add(callback); callback(clone(this.profile));
    return () => this.authListeners.delete(callback);
  }
  async registerStudent(name: string, email: string): Promise<UserProfile> {
    const profile = { uid: `demo-student-${Date.now()}`, name, normalizedEmail: email.toLowerCase(), role: "student" as const, createdAt: Date.now() };
    this.profile = profile; this.emitAuth(); return clone(profile);
  }
  async login(email: string): Promise<UserProfile> {
    const normalized = email.toLowerCase();
    this.profile = normalized === TEACHER.normalizedEmail ? TEACHER :
      STUDENTS.find((student) => student.normalizedEmail === normalized) ?? STUDENTS[0];
    this.emitAuth(); return clone(this.profile);
  }
  async logout() { this.profile = null; this.emitAuth(); }
  async createLecture(input: Omit<Lecture, "id" | "createdAt" | "updatedAt">): Promise<Lecture> {
    const now = Date.now();
    const created = { ...input, id: `demo-lecture-${now}`, createdAt: now, updatedAt: now };
    this.lectures.push(created); this.emitLectures(); return clone(created);
  }
  async updateLecture(id: string, changes: Partial<Lecture>) {
    this.lectures = this.lectures.map((item) => item.id === id ? { ...item, ...changes, updatedAt: Date.now() } : item);
    this.emitLectures();
  }
  async deleteLecture(id: string) { this.lectures = this.lectures.filter((item) => item.id !== id); this.emitLectures(); }
  subscribeTeacherLectures(teacherId: string, callback: (lectures: Lecture[]) => void): Unsubscribe {
    const emit = () => callback(clone(this.lectures.filter((item) => item.teacherId === teacherId)));
    this.lectureListeners.add(emit); emit(); return () => this.lectureListeners.delete(emit);
  }
  subscribeStudentLectures(email: string, callback: (lectures: Lecture[]) => void): Unsubscribe {
    const emit = () => callback(clone(this.lectures.filter((item) => item.studentEmails.includes(email))));
    this.lectureListeners.add(emit); emit(); return () => this.lectureListeners.delete(emit);
  }
  subscribeToLectureSubmissions(lectureId: string, callback: (submissions: Submission[]) => void): Unsubscribe {
    const emit = () => callback(clone(this.submissions.get(lectureId) ?? []));
    this.submissionListeners.add(emit); emit(); return () => this.submissionListeners.delete(emit);
  }
  subscribeToStudentSubmission(lectureId: string, studentUid: string, callback: (submission: Submission | null) => void): Unsubscribe {
    const emit = () => callback(clone((this.submissions.get(lectureId) ?? []).find((item) => item.studentUid === studentUid) ?? null));
    this.submissionListeners.add(emit); emit(); return () => this.submissionListeners.delete(emit);
  }
  async saveOwnSubmission(lectureId: string, profile: UserProfile, submission: Submission) {
    if (submission.studentUid !== profile.uid || submission.studentEmail !== profile.normalizedEmail) {
      throw new Error("Students may submit only their own session.");
    }
    const lecture = this.lectures.find((item) => item.id === lectureId);
    if (!lecture?.studentEmails.includes(profile.normalizedEmail)) throw new Error("Student is not assigned to this lecture.");
    const current = this.submissions.get(lectureId) ?? [];
    this.submissions.set(lectureId, [...current.filter((item) => item.studentUid !== profile.uid), clone(submission)]);
    this.submissionListeners.forEach((listener) => listener());
  }
  private emitAuth() { this.authListeners.forEach((listener) => listener(clone(this.profile))); }
  private emitLectures() { this.lectureListeners.forEach((listener) => listener()); }
}
