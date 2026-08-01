const DETACHED = new Map();

function windowsGet(windowId) {
  return new Promise((resolve, reject) => {
    chrome.windows.get(windowId, (windowInfo) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(windowInfo);
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

function tabsMove(tabId, moveProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.move(tabId, moveProperties, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tab);
    });
  });
}

function windowsRemove(windowId) {
  return new Promise((resolve, reject) => {
    chrome.windows.remove(windowId, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

chrome.tabs.onDetached.addListener((tabId, info) => {
  DETACHED.set(tabId, {
    oldPosition: info.oldPosition,
    oldWindowId: info.oldWindowId
  });
});

chrome.tabs.onAttached.addListener(async (tabId, info) => {
  const record = DETACHED.get(tabId);
  if (!record) {
    return;
  }
  DETACHED.delete(tabId);

  try {
    const currentTabs = await tabsQuery({ windowId: info.newWindowId });
    if (currentTabs.length !== 1) {
      return;
    }

    await windowsGet(record.oldWindowId);
    await tabsMove(tabId, {
      windowId: record.oldWindowId,
      index: record.oldPosition
    });

    const leftoverTabs = await tabsQuery({ windowId: info.newWindowId });
    if (leftoverTabs.length === 0) {
      await windowsRemove(info.newWindowId);
    }
  } catch (error) {
    console.warn("Unable to restore detached tab:", error.message);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  DETACHED.delete(tabId);
});
