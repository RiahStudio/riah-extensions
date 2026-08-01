(function () {
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

  async function applyPreferredQuality() {
    const { preferredQuality = "auto" } = await storageGet({ preferredQuality: "auto" });
    document.dispatchEvent(
      new CustomEvent("riah-youtube-quality-set", {
        detail: { preferred: preferredQuality }
      })
    );
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "riah-youtube-quality-apply") {
      return;
    }

    applyPreferredQuality()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  applyPreferredQuality().catch((error) => console.warn(error.message));
})();
