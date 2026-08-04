function storageGet(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, (value) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(value);
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tabs[0] || null);
    });
  });
}

function sendMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      resolve();
    });
  });
}

async function main() {
  const autoplayToggle = document.getElementById("autoplayEnabled");
  const captionsToggle = document.getElementById("captionsOff");
  const holdToggle = document.getElementById("holdPaused");
  const status = document.getElementById("status");
  const {
    autoplayEnabled = false,
    captionsOff = true,
    holdPaused = true
  } = await storageGet({ autoplayEnabled: false, captionsOff: true, holdPaused: true });

  autoplayToggle.checked = autoplayEnabled;
  captionsToggle.checked = captionsOff;
  holdToggle.checked = holdPaused;
  status.textContent = "Preferences are active on YouTube watch pages and Shorts.";

  async function saveAndApply() {
    await storageSet({
      autoplayEnabled: autoplayToggle.checked,
      captionsOff: captionsToggle.checked,
      holdPaused: holdToggle.checked
    });
    status.textContent = "Saved. Applying on the current tab.";
    const tab = await queryActiveTab();
    if (tab?.id) {
      await sendMessage(tab.id, { type: "riah-youtube-controls-apply" });
    }
  }

  autoplayToggle.addEventListener("change", saveAndApply);
  captionsToggle.addEventListener("change", saveAndApply);
  holdToggle.addEventListener("change", saveAndApply);
}

main();
