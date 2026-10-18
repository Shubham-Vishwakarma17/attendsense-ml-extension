import type { ReactNode } from "react";
import { useAuth } from "../auth";
import { useRepository } from "../services/repository";

export function Layout({ children }: { children: ReactNode }) {
  const { profile } = useAuth(); const repository = useRepository();
  return <><header className="topbar"><div><span className="brand">AttendSense</span><span className="tagline">Observable participation</span></div>
    <div>{profile?.name}<button className="link-button" onClick={() => repository.logout()}>Log out</button></div></header>
    {repository.mode === "demo" && <div className="demo-banner" role="status">DEMO MODE · Synthetic sample data · Not real authentication or real-world accuracy</div>}
    <div className="model-warning">Synthetic demo model. Results demonstrate the software workflow and are not evidence of real-world accuracy.</div>
    {children}<footer>No camera · No microphone · No audio/video · No browsing history · Explicit session upload only</footer></>;
}
