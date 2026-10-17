import {
  SESSION_STORAGE_KEY,
  STOP_REASONS,
  addSample,
  createSession,
  stopSession
} from "../lib/session.js";

const MEET_URL = /^https:\/\/meet\.google\.com\//;
let mutationQueue = Promise.resolve();

function enqueueMutation(task) {
  const result = mutationQueue.then(task);
  mutationQueue = result.catch((error) => {
    console.error("AttendSense session mutation failed:", error);
  });
  return result;
}

async function loadSession() {
  const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
  return stored[SESSION_STORAGE_KEY] ?? null;
}

async function saveSession(session) {
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: session });
}

async function cancelPreparedSession(tabId, sessionId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "SESSION_CANCELLED", sessionId });
  } catch {
    // The tab may have navigated after acknowledging the preparation handshake.
  }
}

async function notifySessionEnded(tabId, sessionId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "SESSION_ENDED", sessionId });
  } catch {
    // A navigating or closed tab may no longer have a reachable content script.
  }
}

async function prepareContentScript(tabId, sessionId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "PREPARE_SESSION",
      sessionId
    });
    return response?.ready === true && response.sessionId === sessionId;
  } catch (error) {
    console.warn("AttendSense could not reach the Google Meet content script:", error);
    return false;
  }
}

async function stopMatchingSession(tabId, reason) {
  return enqueueMutation(async () => {
    const session = await loadSession();
    if (!session?.active || session.tabId !== tabId) return null;
    const next = stopSession(session, Date.now(), reason);
    await saveSession(next);
    return next;
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === "START_SESSION") {
      const response = await enqueueMutation(async () => {
        const session = await loadSession();
        if (session?.active) {
          return { ok: false, error: "A lecture session is already active.", session };
        }
        if (!Number.isInteger(message.tabId) || !MEET_URL.test(message.url ?? "")) {
          return { ok: false, error: "Open a Google Meet tab before starting." };
        }

        const next = createSession({
          id: crypto.randomUUID(),
          startedAt: Date.now(),
          tabId: message.tabId
        });

        if (!(await prepareContentScript(next.tabId, next.id))) {
          return {
            ok: false,
            code: "CONTENT_SCRIPT_UNAVAILABLE",
            error: "Refresh the Google Meet page and try again.",
            session
          };
        }

        try {
          await saveSession(next);
        } catch (error) {
          await cancelPreparedSession(next.tabId, next.id);
          throw error;
        }
        return { ok: true, session: next };
      });
      sendResponse(response);
      return;
    }

    if (message.type === "STOP_SESSION") {
      const response = await enqueueMutation(async () => {
        const session = await loadSession();
        if (!session?.active) {
          return { ok: false, error: "There is no active session.", session };
        }
        const next = stopSession(session, Date.now(), STOP_REASONS.USER);
        await saveSession(next);
        await notifySessionEnded(session.tabId, session.id);
        return { ok: true, session: next };
      });
      sendResponse(response);
      return;
    }

    if (message.type === "ACTIVITY_SAMPLE") {
      const response = await enqueueMutation(async () => {
        const session = await loadSession();
        if (!session?.active || sender.tab?.id !== session.tabId || message.sessionId !== session.id) {
          return { ok: false, ignored: true };
        }
        const next = addSample(session, message.sample);
        await saveSession(next);
        return { ok: true };
      });
      sendResponse(response);
      return;
    }

    if (message.type === "GET_SESSION") {
      await mutationQueue;
      const session = await loadSession();
      sendResponse({ ok: true, session });
      return;
    }

    if (message.type === "GET_CONTENT_STATE") {
      await mutationQueue;
      const session = await loadSession();
      const belongsToSender = session?.active && sender.tab?.id === session.tabId;
      sendResponse({
        ok: true,
        active: Boolean(belongsToSender),
        sessionId: belongsToSender ? session.id : null
      });
      return;
    }

    sendResponse({ ok: false, error: "Unknown message type." });
  })().catch((error) => {
    console.error("AttendSense message handling failed:", error);
    sendResponse({ ok: false, error: "Unable to update the session. Please try again." });
  });

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    stopMatchingSession(tabId, STOP_REASONS.MONITORED_TAB_NAVIGATED).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stopMatchingSession(tabId, STOP_REASONS.MONITORED_TAB_CLOSED).catch(() => {});
});
