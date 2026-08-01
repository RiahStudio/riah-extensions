chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ disabledHosts: [] }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.warn("Failed to read Absolute Right Click defaults:", error.message);
    }
  });
});
