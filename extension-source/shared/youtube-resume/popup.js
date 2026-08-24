const PLACE_PREFIX = "place:";
const SETTINGS_KEY = "settings";
const SETTINGS_DEFAULTS = { enabled: true, holdPaused: true };

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (value) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(value || {});
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

async function placeKeys() {
  const everything = await storageGet(null);
  return Object.keys(everything).filter((key) => key.startsWith(PLACE_PREFIX));
}

async function showCount() {
  const keys = await placeKeys();
  const countNode = document.getElementById("count");
  if (keys.length === 0) {
    countNode.textContent = "No places saved yet.";
    return;
  }
  countNode.textContent = keys.length === 1 ? "1 video place saved." : `${keys.length} video places saved.`;
}

async function main() {
  const enabledNode = document.getElementById("enabled");
  const holdPausedNode = document.getElementById("holdPaused");
  const statusNode = document.getElementById("status");

  const stored = await storageGet(SETTINGS_KEY);
  const settings = { ...SETTINGS_DEFAULTS, ...(stored[SETTINGS_KEY] || {}) };
  enabledNode.checked = settings.enabled === true;
  holdPausedNode.checked = settings.holdPaused === true;
  await showCount();

  const persist = async () => {
    await storageSet({
      [SETTINGS_KEY]: { enabled: enabledNode.checked, holdPaused: holdPausedNode.checked }
    });
    statusNode.textContent = "Saved. Reload the YouTube tab to apply.";
  };

  enabledNode.addEventListener("change", persist);
  holdPausedNode.addEventListener("change", persist);

  document.getElementById("forget").addEventListener("click", async () => {
    const keys = await placeKeys();
    if (keys.length > 0) await storageRemove(keys);
    await showCount();
    statusNode.textContent = "Saved places cleared.";
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
