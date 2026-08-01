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
  const statusNode = document.getElementById("status");
  const modeNodes = Array.from(document.querySelectorAll("input[name='mode']"));
  const tab = await queryActiveTab();
  const host = tab?.url ? new URL(tab.url).hostname : "this page";
  const tabId = tab?.id;
  const settings = await storageGet({ defaultMode: "reject", siteModes: {} });
  const currentMode = settings.siteModes[host] || "reject";

  hostNode.textContent = host;
  const selected = modeNodes.find((node) => node.value === currentMode) || modeNodes[0];
  selected.checked = true;

  for (const node of modeNodes) {
    node.addEventListener("change", async () => {
      settings.siteModes[host] = node.value;
      await storageSet(settings);
      if (typeof tabId === "number") {
        await reloadTab(tabId);
      }
      statusNode.textContent = "Saved and reloaded.";
    });
  }
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
