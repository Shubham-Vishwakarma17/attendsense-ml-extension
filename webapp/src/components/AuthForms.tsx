import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { roleHome } from "../auth";
import { useRepository } from "../services/repository";

export function LoginForm() {
  const repository = useRepository(); const navigate = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { const profile = await repository.login(email, password); navigate(roleHome(profile.role)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Login failed."); }
  }
  return <main className="auth-shell"><form className="card auth-card" onSubmit={submit}>
    <p className="eyebrow">OBSERVABLE PARTICIPATION PORTAL</p><h1>Welcome to AttendSense</h1>
    <label>Email<input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
    <label>Password<input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    <button type="submit">Log in</button><p role="alert">{message}</p>
    <p>New student? <Link to="/register">Create an account</Link></p>
    {repository.mode === "demo" && <p className="hint">Teacher: teacher@demo.local · Student: student@demo.local · any password</p>}
  </form></main>;
}

export function RegistrationForm() {
  const repository = useRepository(); const navigate = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    try { const profile = await repository.registerStudent(name.trim(), email.trim(), password); navigate(roleHome(profile.role)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Registration failed."); }
  }
  return <main className="auth-shell"><form className="card auth-card" onSubmit={submit}>
    <p className="eyebrow">STUDENT REGISTRATION</p><h1>Create your account</h1>
    <p className="hint">Public registration always creates a student account. Teacher roles are provisioned by an administrator.</p>
    <label>Name<input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} required /></label>
    <label>Email<input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
    <label>Password<input aria-label="Password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
    <button type="submit">Register as student</button><p role="alert">{message}</p>
    <Link to="/login">Back to login</Link>
  </form></main>;
}
