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

function sendToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, () => resolve());
  });
}

async function main() {
  const selectNode = document.getElementById("preferredQuality");
  const statusNode = document.getElementById("status");
  const { preferredQuality = "auto" } = await storageGet({ preferredQuality: "auto" });
  selectNode.value = preferredQuality;

  document.getElementById("save").addEventListener("click", async () => {
    await storageSet({ preferredQuality: selectNode.value });
    const tab = await queryActiveTab();
    if (tab?.id) {
      await sendToTab(tab.id, { type: "riah-youtube-quality-apply" });
    }
    statusNode.textContent = "Saved.";
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
