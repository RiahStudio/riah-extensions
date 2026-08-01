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

function reloadTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.reload(tabId, () => resolve());
  });
}

async function main() {
  const hostNode = document.getElementById("host");
  const enabledNode = document.getElementById("enabled");
  const modeNode = document.getElementById("mode");
  const statusNode = document.getElementById("status");
  const tab = await queryActiveTab();
  const host = tab?.url ? new URL(tab.url).hostname : "this page";
  const tabId = tab?.id;
  const settings = await storageGet({ disabledHosts: [], modeByHost: {} });

  hostNode.textContent = host;
  enabledNode.checked = !settings.disabledHosts.includes(host);
  modeNode.value = settings.modeByHost[host] || "annotate";

  async function save() {
    const disabledHosts = new Set(settings.disabledHosts);
    if (enabledNode.checked) {
      disabledHosts.delete(host);
    } else {
      disabledHosts.add(host);
    }
    settings.disabledHosts = Array.from(disabledHosts).sort();
    settings.modeByHost[host] = modeNode.value;
    await storageSet(settings);
    if (typeof tabId === "number") {
      await reloadTab(tabId);
    }
    statusNode.textContent = "Saved and reloaded.";
  }

  enabledNode.addEventListener("change", () => save().catch((error) => (statusNode.textContent = error.message)));
  modeNode.addEventListener("change", () => save().catch((error) => (statusNode.textContent = error.message)));
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
