import { SESSION_STORAGE_KEY, calculateSessionMetrics } from "../lib/session.js";

const elements = {
  status: document.querySelector("#status"),
  duration: document.querySelector("#duration"),
  sampleCount: document.querySelector("#sample-count"),
  tabVisible: document.querySelector("#tab-visible"),
  windowFocused: document.querySelector("#window-focused"),
  interaction: document.querySelector("#interaction"),
  message: document.querySelector("#message"),
  start: document.querySelector("#start"),
  stop: document.querySelector("#stop")
};

let currentSession = null;
let busy = false;

const automaticStopMessages = {
  monitored_tab_navigated: "Session ended because the monitored tab navigated or reloaded.",
  monitored_tab_closed: "Session ended because the monitored tab was closed."
};

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const base = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${String(hours).padStart(2, "0")}:${base}` : base;
}

function formatPercentage(value) {
  return `${Math.round(value)}%`;
}

function render() {
  const metrics = calculateSessionMetrics(currentSession);
  elements.status.textContent = metrics.status;
  elements.status.classList.toggle("active", currentSession?.active === true);
  elements.duration.textContent = formatDuration(metrics.durationSeconds);
  elements.sampleCount.textContent = String(metrics.sampleCount);
  elements.tabVisible.textContent = formatPercentage(metrics.tabVisiblePercentage);
  elements.windowFocused.textContent = formatPercentage(metrics.windowFocusedPercentage);
  elements.interaction.textContent = formatPercentage(metrics.interactionPercentage);
  elements.start.disabled = busy || currentSession?.active === true;
  elements.stop.disabled = busy || currentSession?.active !== true;
}

function showAutomaticStopMessage(session) {
  const message = automaticStopMessages[session?.stopReason];
  if (message) elements.message.textContent = message;
}

function reportError(action, error) {
  console.error(`AttendSense ${action} failed:`, error);
  elements.message.textContent = `Unable to ${action} the session. Please try again.`;
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
  currentSession = response.session;
  render();
  showAutomaticStopMessage(currentSession);
}

elements.start.addEventListener("click", async () => {
  elements.message.textContent = "";
  busy = true;
  render();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.runtime.sendMessage({
      type: "START_SESSION",
      tabId: tab?.id,
      url: tab?.url
    });
    if (!response?.ok) elements.message.textContent = response?.error ?? "Unable to start the session.";
    currentSession = response?.session ?? currentSession;
  } catch (error) {
    reportError("start", error);
  } finally {
    busy = false;
    render();
  }
});

elements.stop.addEventListener("click", async () => {
  elements.message.textContent = "";
  busy = true;
  render();
  try {
    const response = await chrome.runtime.sendMessage({ type: "STOP_SESSION" });
    if (!response?.ok) elements.message.textContent = response?.error ?? "Unable to stop the session.";
    currentSession = response?.session ?? currentSession;
  } catch (error) {
    reportError("stop", error);
  } finally {
    busy = false;
    render();
  }
});

refresh().catch((error) => {
  elements.message.textContent = `Unable to load session: ${error.message}`;
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[SESSION_STORAGE_KEY]) {
    currentSession = changes[SESSION_STORAGE_KEY].newValue ?? null;
    render();
    showAutomaticStopMessage(currentSession);
  }
});
window.setInterval(() => currentSession?.active && render(), 1000);
