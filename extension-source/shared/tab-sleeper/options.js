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

async function main() {
  const form = document.getElementById("form");
  const thresholdNode = document.getElementById("thresholdMin");
  const excludeNode = document.getElementById("excludeHosts");
  const statusNode = document.getElementById("status");
  const { thresholdMin = 5, excludeHosts = [] } = await storageGet({
    thresholdMin: 5,
    excludeHosts: []
  });

  thresholdNode.value = thresholdMin;
  excludeNode.value = excludeHosts.join("\n");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await storageSet({
      thresholdMin: Math.max(1, parseInt(thresholdNode.value, 10) || 5),
      excludeHosts: excludeNode.value
        .split(/\r?\n/)
        .map((host) => host.trim())
        .filter(Boolean)
    });
    statusNode.textContent = "Saved.";
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
