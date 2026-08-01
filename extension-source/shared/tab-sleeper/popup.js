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

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function formatIdle(idleMs) {
  const totalSeconds = Math.floor(idleMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `Idle ${minutes}m ${seconds}s`;
}

async function main() {
  const hostNode = document.getElementById("host");
  const idleNode = document.getElementById("idle");
  const excludeNode = document.getElementById("excludeHost");
  const statusNode = document.getElementById("status");
  const tab = await queryActiveTab();
  const info = await sendMessage({ type: "riah-tab-sleeper-status", tabId: tab.id });
  const settings = await storageGet({ excludeHosts: [] });

  if (info.error) {
    statusNode.textContent = info.error;
    return;
  }

  hostNode.textContent = info.host || "Unsupported page";
  idleNode.textContent = formatIdle(info.idleMs || 0);
  excludeNode.checked = settings.excludeHosts.includes(info.host);

  excludeNode.addEventListener("change", async () => {
    const next = new Set(settings.excludeHosts);
    if (excludeNode.checked) {
      next.add(info.host);
    } else {
      next.delete(info.host);
    }
    settings.excludeHosts = Array.from(next).sort();
    await storageSet({ excludeHosts: settings.excludeHosts });
    statusNode.textContent = excludeNode.checked
      ? "This host will stay loaded."
      : "This host can now be discarded.";
  });

  document.getElementById("discardNow").addEventListener("click", async () => {
    const response = await sendMessage({
      type: "riah-tab-sleeper-now",
      tabId: tab.id
    });
    statusNode.textContent = response?.ok ? "Tab discarded." : response?.error || "Unable to discard tab.";
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
