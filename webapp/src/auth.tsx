import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Role, UserProfile } from "./types";
import { useRepository } from "./services/repository";

interface AuthState { profile: UserProfile | null; loading: boolean; }
const AuthContext = createContext<AuthState>({ profile: null, loading: true });
export const roleHome = (role: Role) => role === "teacher" ? "/teacher" : "/student";

export function AuthProvider({ children }: { children: ReactNode }) {
  const repository = useRepository();
  const [state, setState] = useState<AuthState>({ profile: null, loading: true });
  useEffect(() => repository.subscribeAuth((profile) => setState({ profile, loading: false })), [repository]);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

export function ProtectedRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { profile, loading } = useAuth(); const location = useLocation();
  if (loading) return <p role="status">Checking your account…</p>;
  if (!profile) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (profile.role !== role) return <Navigate to={roleHome(profile.role)} replace />;
  return children;
}
