const SWEEP_ALARM = "sweep";

function storageGet(area, defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage[area].get(defaults, (value) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(value);
    });
  });
}

function storageSet(area, value) {
  return new Promise((resolve, reject) => {
    chrome.storage[area].set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function tabsGet(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function tabsQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tabs);
    });
  });
}

function tabsDiscard(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.discard(tabId, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function parseHost(url) {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return null;
  }
}

function isExcluded(host, excludedHosts) {
  return excludedHosts.some((item) => host === item || host.endsWith(`.${item}`));
}

async function touchTab(tabId) {
  const { activityByTab = {} } = await storageGet("local", { activityByTab: {} });
  activityByTab[String(tabId)] = Date.now();
  await storageSet("local", { activityByTab });
}

async function forgetTab(tabId) {
  const { activityByTab = {} } = await storageGet("local", { activityByTab: {} });
  delete activityByTab[String(tabId)];
  await storageSet("local", { activityByTab });
}

function ensureAlarm() {
  chrome.alarms.create(SWEEP_ALARM, { periodInMinutes: 1 });
}

async function sweep() {
  const { thresholdMin = 5, excludeHosts = [] } = await storageGet("sync", {
    thresholdMin: 5,
    excludeHosts: []
  });
  const { activityByTab = {} } = await storageGet("local", { activityByTab: {} });
  const cutoff = Date.now() - thresholdMin * 60 * 1000;
  const tabs = await tabsQuery({});

  for (const tab of tabs) {
    if (
      !tab?.id ||
      tab.active ||
      tab.pinned ||
      tab.audible ||
      tab.discarded
    ) {
      continue;
    }

    const host = parseHost(tab.url);
    if (!host || isExcluded(host, excludeHosts)) {
      continue;
    }

    const last = activityByTab[String(tab.id)] || tab.lastAccessed || 0;
    if (last >= cutoff) {
      continue;
    }

    try {
      await tabsDiscard(tab.id);
    } catch (error) {
      console.warn("Unable to discard tab:", error.message);
    }
  }
}

ensureAlarm();
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

chrome.tabs.onActivated.addListener(({ tabId }) => {
  touchTab(tabId).catch((error) => console.warn(error.message));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status || typeof changeInfo.audible !== "undefined") {
    touchTab(tabId).catch((error) => console.warn(error.message));
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  forgetTab(tabId).catch((error) => console.warn(error.message));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SWEEP_ALARM) {
    return;
  }
  sweep().catch((error) => console.warn(error.message));
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "riah-tab-sleeper-status") {
    (async () => {
      const tab = await tabsGet(message.tabId);
      const host = parseHost(tab.url);
      const { thresholdMin = 5, excludeHosts = [] } = await storageGet("sync", {
        thresholdMin: 5,
        excludeHosts: []
      });
      const { activityByTab = {} } = await storageGet("local", { activityByTab: {} });
      const last = activityByTab[String(message.tabId)] || tab.lastAccessed || Date.now();

      sendResponse({
        host,
        idleMs: Math.max(0, Date.now() - last),
        excluded: !!host && isExcluded(host, excludeHosts),
        thresholdMin
      });
    })().catch((error) => sendResponse({ error: error.message }));
    return true;
  }

  if (message?.type === "riah-tab-sleeper-now") {
    tabsDiscard(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});
