chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ allowedHosts: [] }, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.warn("Autoplay Stopper init failed:", error.message);
    }
  });
});
