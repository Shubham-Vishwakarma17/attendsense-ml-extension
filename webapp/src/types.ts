export type Role = "student" | "teacher";
export type LectureStatus = "scheduled" | "active" | "completed";
export type ParticipationLabel = "active_participation" | "passive_listening" | "away_from_lecture";

export interface UserProfile {
  uid: string;
  name: string;
  normalizedEmail: string;
  role: Role;
  createdAt: number;
}

export interface Lecture {
  id: string;
  title: string;
  description: string;
  meetUrl: string;
  teacherId: string;
  teacherName: string;
  studentEmails: string[];
  scheduledAt: number;
  status: LectureStatus;
  createdAt: number;
  updatedAt: number;
}

export interface SessionSample {
  sampleIndex: number;
  elapsedSeconds: number;
  tabVisible: boolean;
  windowFocused: boolean;
  idleSeconds: number;
  recentlyInteracted: boolean;
  facePresent: null;
}

export interface ValidatedSession {
  exportSchemaVersion: number;
  sessionId: string;
  sessionSchemaVersion: number | null;
  startedAt: number;
  stoppedAt: number;
  stopReason: "user" | "monitored_tab_navigated" | "monitored_tab_closed";
  durationSeconds: number;
  participationLabel: ParticipationLabel | null;
  sampleCount: number;
  samples: SessionSample[];
}

export interface Prediction {
  predictionType: "observable participation prediction";
  predictedParticipationLabel: ParticipationLabel;
  classProbabilities: Record<ParticipationLabel, number>;
  modelVersion: string;
  datasetKind: "synthetic_demo";
  scientificBoundary: string;
}

export interface Submission {
  studentUid: string;
  studentName: string;
  studentEmail: string;
  sessionId: string;
  sessionSchemaVersion: number | null;
  startedAt: number;
  stoppedAt: number;
  stopReason: ValidatedSession["stopReason"];
  durationSeconds: number;
  sampleCount: number;
  tabVisiblePercent: number;
  windowFocusedPercent: number;
  recentInteractionPercent: number;
  meanIdleSeconds: number;
  predictedParticipationLabel: ParticipationLabel;
  classProbabilities: Record<ParticipationLabel, number>;
  predictionType: Prediction["predictionType"];
  modelVersion: string;
  datasetKind: "synthetic_demo";
  scientificBoundary: string;
  participantProvidedLabel: ParticipationLabel | null;
  samples: SessionSample[];
  submittedAt: number;
  updatedAt: number;
}

export type Unsubscribe = () => void;

export interface PlatformRepository {
  readonly mode: "firebase" | "demo";
  subscribeAuth(callback: (profile: UserProfile | null) => void): Unsubscribe;
  registerStudent(name: string, email: string, password: string): Promise<UserProfile>;
  login(email: string, password: string): Promise<UserProfile>;
  logout(): Promise<void>;
  createLecture(input: Omit<Lecture, "id" | "createdAt" | "updatedAt">): Promise<Lecture>;
  updateLecture(lectureId: string, changes: Partial<Pick<Lecture, "status" | "title" | "description" | "scheduledAt" | "studentEmails">>): Promise<void>;
  deleteLecture(lectureId: string): Promise<void>;
  subscribeTeacherLectures(teacherId: string, callback: (lectures: Lecture[]) => void, onError?: () => void): Unsubscribe;
  subscribeStudentLectures(normalizedEmail: string, callback: (lectures: Lecture[]) => void, onError?: () => void): Unsubscribe;
  subscribeToLectureSubmissions(lectureId: string, callback: (submissions: Submission[]) => void, onError?: () => void): Unsubscribe;
  subscribeToStudentSubmission(lectureId: string, studentUid: string, callback: (submission: Submission | null) => void, onError?: () => void): Unsubscribe;
  saveOwnSubmission(lectureId: string, profile: UserProfile, submission: Submission): Promise<void>;
}
