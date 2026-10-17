(() => {
  const SAMPLE_INTERVAL_MS = 10_000;
  let sessionId = null;
  let intervalId = null;
  let lastInteractionAt = Date.now();

  function noteInteraction() {
    lastInteractionAt = Date.now();
  }

  for (const eventName of ["keydown", "pointerdown", "pointermove", "wheel", "touchstart"]) {
    window.addEventListener(eventName, noteInteraction, { passive: true });
  }

  function collectSample() {
    if (!sessionId) return;
    const now = Date.now();
    const idleSeconds = Math.max(0, (now - lastInteractionAt) / 1000);

    chrome.runtime.sendMessage({
      type: "ACTIVITY_SAMPLE",
      sessionId,
      sample: {
        timestamp: now,
        tabVisible: document.visibilityState === "visible",
        windowFocused: document.hasFocus(),
        idleSeconds,
        recentlyInteracted: idleSeconds <= SAMPLE_INTERVAL_MS / 1000,
        facePresent: null
      }
    }).catch(() => stopMonitoring());
  }

  function startMonitoring(nextSessionId) {
    if (intervalId && sessionId === nextSessionId) return;
    stopMonitoring();
    sessionId = nextSessionId;
    lastInteractionAt = Date.now();
    intervalId = window.setInterval(collectSample, SAMPLE_INTERVAL_MS);
  }

  function stopMonitoring() {
    if (intervalId) window.clearInterval(intervalId);
    intervalId = null;
    sessionId = null;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "PREPARE_SESSION") {
      startMonitoring(message.sessionId);
      sendResponse({ ready: true, sessionId: message.sessionId });
      return;
    }
    if (["SESSION_CANCELLED", "SESSION_ENDED"].includes(message.type) && message.sessionId === sessionId) {
      stopMonitoring();
    }
  });

  chrome.runtime.sendMessage({ type: "GET_CONTENT_STATE" }).then((response) => {
    if (response?.active) startMonitoring(response.sessionId);
  }).catch(() => {});
})();
