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
  const allowedNode = document.getElementById("allowed");
  const statusNode = document.getElementById("status");
  const tab = await queryActiveTab();
  const host = tab?.url ? new URL(tab.url).hostname : "this page";
  const tabId = tab?.id;
  const { allowedHosts = [] } = await storageGet({ allowedHosts: [] });

  hostNode.textContent = host;
  allowedNode.checked = allowedHosts.includes(host);

  allowedNode.addEventListener("change", async () => {
    const next = new Set(allowedHosts);
    if (allowedNode.checked) {
      next.add(host);
    } else {
      next.delete(host);
    }
    allowedHosts.length = 0;
    allowedHosts.push(...Array.from(next).sort());
    await storageSet({ allowedHosts });
    if (typeof tabId === "number") {
      await reloadTab(tabId);
    }
    statusNode.textContent = "Saved and reloaded.";
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
