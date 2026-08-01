/**
 * popup.js — Absolute Right Click popup.
 *
 * Reads/writes the disabledHosts list through the shared settings module
 * (RiahSettings, defined in shared/settings/index.js). This is the proof
 * of integration for the shared-settings migration; see ../settings/MIGRATION.md
 * for the plan to move the remaining touchpoints over.
 *
 * Note: background.js still reads chrome.storage.sync directly. That's by
 * design for this pass — one touchpoint per browser build wired; the rest
 * stay on the legacy path until they each get their own migration commit.
 */

const settings = RiahSettings.createSettings();
const DISABLED_HOSTS_KEY = "disabledHosts";

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

function reloadTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.reload(tabId, () => {
      resolve();
    });
  });
}

async function main() {
  const hostNode = document.getElementById("host");
  const enabledNode = document.getElementById("enabled");
  const hintNode = document.getElementById("hint");

  try {
    const tab = await queryActiveTab();
    const url = tab?.url ? new URL(tab.url) : null;
    const host = url?.hostname || "this page";
    const tabId = tab?.id;

    // Shared settings module: returns the full settings object with
    // schema defaults pre-applied, so disabledHosts is always an array.
    const all = await settings.getSettings();
    const disabledHosts = all[DISABLED_HOSTS_KEY];

    hostNode.textContent = host;
    enabledNode.checked = !disabledHosts.includes(host);

    enabledNode.addEventListener("change", async () => {
      const nextHosts = new Set(disabledHosts);
      if (enabledNode.checked) {
        nextHosts.delete(host);
      } else {
        nextHosts.add(host);
      }

      disabledHosts.length = 0;
      disabledHosts.push(...Array.from(nextHosts).sort());

      // Shared settings module: validates the patch against the schema
      // (string-array) and persists via the detected adapter.
      await settings.setSettings({ [DISABLED_HOSTS_KEY]: disabledHosts });

      if (typeof tabId === "number") {
        await reloadTab(tabId);
      }
      hintNode.textContent = enabledNode.checked
        ? "Protection enabled. The page was reloaded."
        : "Site disabled. The page was reloaded.";
    });
  } catch (error) {
    hostNode.textContent = "Unavailable";
    hintNode.textContent = error.message;
    enabledNode.disabled = true;
  }
}

main();
