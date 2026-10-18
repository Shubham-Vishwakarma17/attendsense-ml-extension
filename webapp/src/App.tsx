import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ProtectedRoute, useAuth, roleHome } from "./auth";
import { RepositoryContext } from "./services/repository";
import type { PlatformRepository } from "./types";

const LoginForm = lazy(() => import("./components/AuthForms").then((module) => ({ default: module.LoginForm })));
const RegistrationForm = lazy(() => import("./components/AuthForms").then((module) => ({ default: module.RegistrationForm })));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard").then((module) => ({ default: module.TeacherDashboard })));
const LectureResultsPage = lazy(() => import("./pages/LectureResultsPage").then((module) => ({ default: module.LectureResultsPage })));
const SubmissionDetailsPage = lazy(() => import("./pages/SubmissionDetailsPage").then((module) => ({ default: module.SubmissionDetailsPage })));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard").then((module) => ({ default: module.StudentDashboard })));

function Home() { const { profile, loading } = useAuth(); return loading ? <p>Loading…</p> : <Navigate to={profile ? roleHome(profile.role) : "/login"} replace />; }

export function App({ repository }: { repository: PlatformRepository }) {
  return <RepositoryContext.Provider value={repository}><BrowserRouter><AuthProvider><Suspense fallback={<main className="page"><p role="status">Loading AttendSense…</p></main>}><Routes>
    <Route path="/" element={<Home />} /><Route path="/login" element={<LoginForm />} /><Route path="/register" element={<RegistrationForm />} />
    <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
    <Route path="/teacher/lectures/:lectureId/results" element={<ProtectedRoute role="teacher"><LectureResultsPage /></ProtectedRoute>} />
    <Route path="/teacher/lectures/:lectureId/results/:studentUid" element={<ProtectedRoute role="teacher"><SubmissionDetailsPage /></ProtectedRoute>} />
    <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AuthProvider></BrowserRouter></RepositoryContext.Provider>;
}
