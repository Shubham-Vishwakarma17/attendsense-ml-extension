import { SESSION_STORAGE_KEY, calculateSessionMetrics } from "../lib/session.js";
import {
  createCsvExport,
  createExportFilename,
  createJsonExport,
  isExportableSession,
  isValidParticipationLabel
} from "../lib/dataset.js";

const elements = {
  status: document.querySelector("#status"),
  duration: document.querySelector("#duration"),
  sampleCount: document.querySelector("#sample-count"),
  tabVisible: document.querySelector("#tab-visible"),
  windowFocused: document.querySelector("#window-focused"),
  interaction: document.querySelector("#interaction"),
  label: document.querySelector("#participation-label"),
  saveLabel: document.querySelector("#save-label"),
  exportCsv: document.querySelector("#export-csv"),
  exportJson: document.querySelector("#export-json"),
  message: document.querySelector("#message"),
  start: document.querySelector("#start"),
  stop: document.querySelector("#stop")
};

let currentSession = null;
let busy = false;
let selectedLabel = "";

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
  const canLabel = !busy && currentSession?.active === false && currentSession.samples?.length > 0;
  elements.label.disabled = !canLabel;
  elements.label.value = selectedLabel;
  elements.saveLabel.disabled = !canLabel || !isValidParticipationLabel(selectedLabel);
  const canExport = !busy && isExportableSession(currentSession);
  elements.exportCsv.disabled = !canExport;
  elements.exportJson.disabled = !canExport;
}

function showAutomaticStopMessage(session) {
  const message = automaticStopMessages[session?.stopReason];
  if (message) elements.message.textContent = message;
}

function reportError(action, error) {
  console.error(`AttendSense ${action} failed:`, error);
  elements.message.textContent = `Unable to ${action} the session. Please try again.`;
}

function adoptSession(session) {
  currentSession = session ?? null;
  selectedLabel = isValidParticipationLabel(currentSession?.participationLabel)
    ? currentSession.participationLabel
    : "";
}

function downloadLocalFile(contents, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
  adoptSession(response.session);
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
    adoptSession(response?.session ?? currentSession);
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
    adoptSession(response?.session ?? currentSession);
  } catch (error) {
    reportError("stop", error);
  } finally {
    busy = false;
    render();
  }
});

elements.label.addEventListener("change", () => {
  selectedLabel = elements.label.value;
  render();
});

elements.saveLabel.addEventListener("click", async () => {
  elements.message.textContent = "";
  busy = true;
  render();
  try {
    const response = await chrome.runtime.sendMessage({
      type: "SET_PARTICIPATION_LABEL",
      label: selectedLabel
    });
    if (!response?.ok) elements.message.textContent = response?.error ?? "Unable to save the label.";
    adoptSession(response?.session ?? currentSession);
    if (response?.ok) elements.message.textContent = "Research label saved locally.";
  } catch (error) {
    reportError("save", error);
  } finally {
    busy = false;
    render();
  }
});

elements.exportCsv.addEventListener("click", () => {
  try {
    downloadLocalFile(
      createCsvExport(currentSession),
      createExportFilename(currentSession, "csv"),
      "text/csv;charset=utf-8"
    );
  } catch (error) {
    reportError("export", error);
  }
});

elements.exportJson.addEventListener("click", () => {
  try {
    downloadLocalFile(
      createJsonExport(currentSession),
      createExportFilename(currentSession, "json"),
      "application/json;charset=utf-8"
    );
  } catch (error) {
    reportError("export", error);
  }
});

refresh().catch((error) => {
  elements.message.textContent = `Unable to load session: ${error.message}`;
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[SESSION_STORAGE_KEY]) {
    adoptSession(changes[SESSION_STORAGE_KEY].newValue);
    render();
    showAutomaticStopMessage(currentSession);
  }
});
window.setInterval(() => currentSession?.active && render(), 1000);
