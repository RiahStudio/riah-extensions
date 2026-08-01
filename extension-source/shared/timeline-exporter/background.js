function downloadCsv(csv, filename) {
  return new Promise((resolve, reject) => {
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    chrome.downloads.download(
      {
        url,
        filename,
        saveAs: true
      },
      (downloadId) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(downloadId);
      }
    );
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "riah-timeline-exporter-download") {
    downloadCsv(message.csv, message.filename)
      .then((downloadId) => sendResponse({ ok: true, downloadId }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "riah-timeline-exporter-save-settings") {
    storageSet({ includeReplies: !!message.includeReplies })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "riah-timeline-exporter-load-settings") {
    storageGet({ includeReplies: false })
      .then((settings) => sendResponse(settings))
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  }
});
