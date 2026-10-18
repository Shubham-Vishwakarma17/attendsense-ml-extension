import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ProtectedRoute, useAuth, roleHome } from "./auth";
import { LoginForm, RegistrationForm } from "./components/AuthForms";
import { TeacherDashboard } from "./pages/TeacherDashboard";
import { LectureResultsPage } from "./pages/LectureResultsPage";
import { SubmissionDetailsPage } from "./pages/SubmissionDetailsPage";
import { StudentDashboard } from "./pages/StudentDashboard";
import { RepositoryContext } from "./services/repository";
import type { PlatformRepository } from "./types";

function Home() { const { profile, loading } = useAuth(); return loading ? <p>Loading…</p> : <Navigate to={profile ? roleHome(profile.role) : "/login"} replace />; }

export function App({ repository }: { repository: PlatformRepository }) {
  return <RepositoryContext.Provider value={repository}><BrowserRouter><AuthProvider><Routes>
    <Route path="/" element={<Home />} /><Route path="/login" element={<LoginForm />} /><Route path="/register" element={<RegistrationForm />} />
    <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
    <Route path="/teacher/lectures/:lectureId/results" element={<ProtectedRoute role="teacher"><LectureResultsPage /></ProtectedRoute>} />
    <Route path="/teacher/lectures/:lectureId/results/:studentUid" element={<ProtectedRoute role="teacher"><SubmissionDetailsPage /></ProtectedRoute>} />
    <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter></RepositoryContext.Provider>;
}
