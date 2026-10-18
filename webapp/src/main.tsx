import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { DemoRepository } from "./services/demoRepository";
import "./styles.css";

const demoMode = import.meta.env.VITE_DEMO_MODE === "true";
const root = createRoot(document.getElementById("root")!);

async function start() {
  if (demoMode) {
    root.render(<StrictMode><App repository={new DemoRepository()} /></StrictMode>);
    return;
  }
  const { FirebaseRepository, firebaseOptionsFromEnv } = await import("./services/firebaseRepository");
  const firebaseOptions = firebaseOptionsFromEnv();
  if (!firebaseOptions) {
    root.render(<StrictMode><main className="setup"><h1>AttendSense setup required</h1><p>Firebase configuration is missing. Copy <code>webapp/.env.example</code> to <code>webapp/.env</code> and provide the project’s public browser configuration, or explicitly set <code>VITE_DEMO_MODE=true</code> for a local synthetic preview.</p><p>No demo mode is activated automatically.</p></main></StrictMode>);
    return;
  }
  const repository = FirebaseRepository.create(firebaseOptions, import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true");
  root.render(<StrictMode><App repository={repository} /></StrictMode>);
}

void start();
