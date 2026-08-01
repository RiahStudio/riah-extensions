chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    {
      defaultMode: "reject",
      siteModes: {}
    },
    () => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.warn("Cookie Banner Dismisser init failed:", error.message);
      }
    }
  );
});
