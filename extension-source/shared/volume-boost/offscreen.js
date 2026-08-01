(function () {
  const TARGET = "riah-volume-boost-offscreen";
  const DEFAULT_GAIN = 1;
  const MIN_GAIN = 0;
  const MAX_GAIN = 6;
  const captures = new Map();

  function normalizeGain(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return DEFAULT_GAIN;
    }
    const clamped = Math.min(MAX_GAIN, Math.max(MIN_GAIN, numeric));
    return Math.round(clamped * 100) / 100;
  }

  function tabKey(tabId) {
    return String(tabId);
  }

  function status() {
    const tabs = {};
    for (const [key, entry] of captures.entries()) {
      tabs[key] = normalizeGain(entry.gainNode.gain.value);
    }
    return { ok: true, tabs };
  }

  async function releaseCapture(tabId) {
    const key = tabKey(tabId);
    const entry = captures.get(key);
    if (!entry) {
      return { ok: true, released: false };
    }

    try {
      entry.source.disconnect();
    } catch {
      // Already disconnected.
    }
    try {
      entry.gainNode.disconnect();
    } catch {
      // Already disconnected.
    }

    for (const track of entry.stream.getTracks()) {
      track.stop();
    }

    if (entry.context.state !== "closed") {
      await entry.context.close();
    }

    captures.delete(key);
    return { ok: true, released: true };
  }

  async function setGain(tabId, gain) {
    const entry = captures.get(tabKey(tabId));
    if (!entry) {
      throw new Error("This tab is not currently captured.");
    }

    const normalized = normalizeGain(gain);
    entry.gainNode.gain.value = normalized;
    if (entry.context.state === "suspended") {
      await entry.context.resume();
    }
    return { ok: true, gain: normalized };
  }

  async function startCapture(message) {
    const key = tabKey(message.tabId);
    if (captures.has(key)) {
      return setGain(message.tabId, message.gain);
    }

    if (!message.streamId) {
      throw new Error("Missing tab audio stream id.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: message.streamId
        }
      },
      video: false
    });

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const gainNode = context.createGain();
    const gain = normalizeGain(message.gain);
    gainNode.gain.value = gain;
    source.connect(gainNode);
    gainNode.connect(context.destination);

    captures.set(key, {
      stream,
      context,
      source,
      gainNode
    });

    if (context.state === "suspended") {
      await context.resume();
    }

    return { ok: true, gain };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.target !== TARGET) {
      return false;
    }

    (async () => {
      if (message.type === "status") {
        return status();
      }
      if (message.type === "start") {
        return startCapture(message);
      }
      if (message.type === "set") {
        return setGain(message.tabId, message.gain);
      }
      if (message.type === "release") {
        return releaseCapture(message.tabId);
      }
      throw new Error("Unknown Riah Volume Boost offscreen message.");
    })()
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error)
      }));

    return true;
  });
})();
