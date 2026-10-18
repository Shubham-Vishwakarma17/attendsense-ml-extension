import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut, type Auth
} from "firebase/auth";
import {
  addDoc, collection, connectFirestoreEmulator, deleteDoc, doc, getDoc, getFirestore,
  onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, type Firestore
} from "firebase/firestore";
import type { Lecture, PlatformRepository, Submission, UserProfile } from "../types";

function milliseconds(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}

function mapLecture(id: string, data: Record<string, unknown>): Lecture {
  return { id, ...data, scheduledAt: milliseconds(data.scheduledAt), createdAt: milliseconds(data.createdAt), updatedAt: milliseconds(data.updatedAt) } as Lecture;
}

function mapSubmission(data: Record<string, unknown>): Submission {
  return { ...data, submittedAt: milliseconds(data.submittedAt), updatedAt: milliseconds(data.updatedAt) } as Submission;
}

export function firebaseOptionsFromEnv(): FirebaseOptions | null {
  const values = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
  return Object.values(values).every(Boolean) ? values : null;
}

export class FirebaseRepository implements PlatformRepository {
  readonly mode = "firebase" as const;
  private constructor(private auth: Auth, private db: Firestore) {}
  static create(options: FirebaseOptions, useEmulators = false) {
    const app = initializeApp(options);
    const auth = getAuth(app); const db = getFirestore(app);
    if (useEmulators) { connectAuthEmulator(auth, "http://127.0.0.1:9099"); connectFirestoreEmulator(db, "127.0.0.1", 8080); }
    return new FirebaseRepository(auth, db);
  }
  private async profile(uid: string): Promise<UserProfile> {
    const snapshot = await getDoc(doc(this.db, "users", uid));
    if (!snapshot.exists()) throw new Error("User profile is missing. Contact the project administrator.");
    const data = snapshot.data();
    return { ...data, createdAt: milliseconds(data.createdAt) } as UserProfile;
  }
  subscribeAuth(callback: (profile: UserProfile | null) => void) {
    return onAuthStateChanged(this.auth, async (user) => callback(user ? await this.profile(user.uid) : null));
  }
  async registerStudent(name: string, email: string, password: string) {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    const profile: UserProfile = { uid: credential.user.uid, name, normalizedEmail: email.trim().toLowerCase(), role: "student", createdAt: Date.now() };
    await setDoc(doc(this.db, "users", profile.uid), { ...profile, createdAt: serverTimestamp() });
    return profile;
  }
  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    return this.profile(credential.user.uid);
  }
  async logout() { await signOut(this.auth); }
  async createLecture(input: Omit<Lecture, "id" | "createdAt" | "updatedAt">) {
    const reference = await addDoc(collection(this.db, "lectures"), { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { ...input, id: reference.id, createdAt: Date.now(), updatedAt: Date.now() };
  }
  async updateLecture(id: string, changes: Partial<Lecture>) { await updateDoc(doc(this.db, "lectures", id), { ...changes, updatedAt: serverTimestamp() }); }
  async deleteLecture(id: string) { await deleteDoc(doc(this.db, "lectures", id)); }
  subscribeTeacherLectures(teacherId: string, callback: (lectures: Lecture[]) => void) {
    return onSnapshot(query(collection(this.db, "lectures"), where("teacherId", "==", teacherId)), (snapshot) => callback(snapshot.docs.map((item) => mapLecture(item.id, item.data()))));
  }
  subscribeStudentLectures(email: string, callback: (lectures: Lecture[]) => void) {
    return onSnapshot(query(collection(this.db, "lectures"), where("studentEmails", "array-contains", email)), (snapshot) => callback(snapshot.docs.map((item) => mapLecture(item.id, item.data()))));
  }
  subscribeToLectureSubmissions(lectureId: string, callback: (submissions: Submission[]) => void) {
    return onSnapshot(collection(this.db, "lectures", lectureId, "submissions"), (snapshot) => callback(snapshot.docs.map((item) => mapSubmission(item.data()))));
  }
  subscribeToStudentSubmission(lectureId: string, studentUid: string, callback: (submission: Submission | null) => void) {
    return onSnapshot(doc(this.db, "lectures", lectureId, "submissions", studentUid), (snapshot) => callback(snapshot.exists() ? mapSubmission(snapshot.data()) : null));
  }
  async saveOwnSubmission(lectureId: string, profile: UserProfile, submission: Submission) {
    if (submission.studentUid !== profile.uid || submission.studentEmail !== profile.normalizedEmail) throw new Error("Submission identity mismatch.");
    await setDoc(doc(this.db, "lectures", lectureId, "submissions", profile.uid), { ...submission, submittedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  }
}
