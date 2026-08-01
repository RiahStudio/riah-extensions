(function () {
  const MESSAGE_PREFIX = "riah-volume-boost-";
  const OFFSCREEN_TARGET = "riah-volume-boost-offscreen";
  const OFFSCREEN_URL = "offscreen.html";
  const STORE_KEY = "volumeBoostByTab";
  const DEFAULT_GAIN = 1;
  const MIN_GAIN = 0;
  const MAX_GAIN = 6;

  function lastError() {
    return chrome.runtime.lastError && chrome.runtime.lastError.message;
  }

  function storageGet(defaults) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(defaults, (result) => {
        const error = lastError();
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve(result || {});
      });
    });
  }

  function storageSet(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        const error = lastError();
        if (error) {
          reject(new Error(error));
          return;
        }
        resolve();
      });
    });
  }

  function queryActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const error = lastError();
        if (error) {
          reject(new Error(error));
          return;
        }

        const tab = tabs && tabs[0];
        if (!tab || typeof tab.id !== "number") {
          reject(new Error("No active tab found."));
          return;
        }
        resolve(tab);
      });
    });
  }

  function getStreamId(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
        const error = lastError();
        if (error) {
          reject(new Error(error));
          return;
        }
        if (!streamId) {
          reject(new Error("Brave did not return a tab audio stream."));
          return;
        }
        resolve(streamId);
      });
    });
  }

  function sendOffscreen(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        Object.assign({ target: OFFSCREEN_TARGET }, message),
        (response) => {
          const error = lastError();
          if (error) {
            reject(new Error(error));
            return;
          }
          if (response && response.ok === false) {
            reject(new Error(response.error || "Riah Volume Boost failed."));
            return;
          }
          resolve(response || { ok: true });
        }
      );
    });
  }

  function normalizeGain(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_GAIN;
    }
    const clamped = Math.min(MAX_GAIN, Math.max(MIN_GAIN, numeric));
    return Math.round(clamped * 100) / 100;
  }

  function gainToPercent(gain) {
    return Math.round(normalizeGain(gain) * 100);
  }

  function readStoredGains() {
    return storageGet({ [STORE_KEY]: {} }).then((result) => {
      const stored = result[STORE_KEY];
      return stored && typeof stored === "object" ? stored : {};
    });
  }

  async function saveStoredGain(tabId, gain) {
    const stored = await readStoredGains();
    const key = String(tabId);
    if (gain === DEFAULT_GAIN) {
      delete stored[key];
    } else {
      stored[key] = gain;
    }
    await storageSet({ [STORE_KEY]: stored });
  }

  async function offscreenExists() {
    if (!chrome.runtime.getContexts) {
      return false;
    }

    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)]
    });
    return contexts.length > 0;
  }

  async function ensureOffscreenDocument() {
    if (!chrome.offscreen || !chrome.offscreen.createDocument) {
      throw new Error("This browser does not support offscreen tab audio capture.");
    }

    if (await offscreenExists()) {
      return;
    }

    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ["USER_MEDIA", "AUDIO_PLAYBACK"],
        justification: "Boost the current tab's audio with user-controlled gain."
      });
    } catch (error) {
      if (!/offscreen document.*already|single offscreen document/i.test(error.message || "")) {
        throw error;
      }
    }
  }

  async function getOffscreenStatus() {
    if (!(await offscreenExists())) {
      return { tabs: {} };
    }

    try {
      const response = await sendOffscreen({ type: "status" });
      return response && response.tabs ? response : { tabs: {} };
    } catch {
      return { tabs: {} };
    }
  }

  function supported() {
    return Boolean(
      chrome.tabCapture &&
        chrome.tabCapture.getMediaStreamId &&
        chrome.offscreen &&
        chrome.offscreen.createDocument
    );
  }

  async function currentStatus() {
    const tab = await queryActiveTab();
    const stored = await readStoredGains();
    const offscreen = await getOffscreenStatus();
    const key = String(tab.id);
    const activeGain = offscreen.tabs[key];
    const storedGain = stored[key];
    const gain = normalizeGain(activeGain == null ? storedGain : activeGain);

    return {
      ok: true,
      supported: supported(),
      tabId: tab.id,
      tabTitle: tab.title || "",
      tabUrl: tab.url || "",
      active: activeGain != null,
      gain,
      percent: gainToPercent(gain)
    };
  }

  async function releaseTab(tabId) {
    if (await offscreenExists()) {
      try {
        await sendOffscreen({ type: "release", tabId });
      } catch {
        // A missing receiver means the offscreen document has already gone away.
      }
    }
    await saveStoredGain(tabId, DEFAULT_GAIN);
  }

  async function setCurrentGain(value) {
    if (!supported()) {
      throw new Error("Riah Volume Boost needs Chromium/Brave tab audio capture.");
    }

    const tab = await queryActiveTab();
    const gain = normalizeGain(value);
    if (gain === DEFAULT_GAIN) {
      await releaseTab(tab.id);
      return currentStatus();
    }

    await ensureOffscreenDocument();
    const offscreen = await getOffscreenStatus();
    const key = String(tab.id);

    if (offscreen.tabs[key] != null) {
      await sendOffscreen({ type: "set", tabId: tab.id, gain });
    } else {
      const streamId = await getStreamId(tab.id);
      await sendOffscreen({ type: "start", tabId: tab.id, streamId, gain });
    }

    await saveStoredGain(tab.id, gain);
    return currentStatus();
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== "string" || !message.type.startsWith(MESSAGE_PREFIX)) {
      return false;
    }

    (async () => {
      if (message.type === "riah-volume-boost-status") {
        return currentStatus();
      }
      if (message.type === "riah-volume-boost-set") {
        return setCurrentGain(message.gain);
      }
      if (message.type === "riah-volume-boost-release") {
        const tab = await queryActiveTab();
        await releaseTab(tab.id);
        return currentStatus();
      }
      throw new Error("Unknown Riah Volume Boost message.");
    })()
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      }));

    return true;
  });

  if (chrome.tabs && chrome.tabs.onRemoved) {
    chrome.tabs.onRemoved.addListener((tabId) => {
      releaseTab(tabId).catch((error) => {
        console.warn("Unable to release Riah Volume Boost tab audio:", error.message);
      });
    });
  }

  if (chrome.tabCapture && chrome.tabCapture.onStatusChanged) {
    chrome.tabCapture.onStatusChanged.addListener((info) => {
      if (!info || typeof info.tabId !== "number") {
        return;
      }
      if (info.status === "stopped" || info.status === "error") {
        saveStoredGain(info.tabId, DEFAULT_GAIN).catch((error) => {
          console.warn("Unable to clear Riah Volume Boost tab state:", error.message);
        });
      }
    });
  }
})();
