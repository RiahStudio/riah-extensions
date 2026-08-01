(function () {
  const host = location.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    return;
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

  function sendConfig(allowed) {
    document.dispatchEvent(
      new CustomEvent("riah-autoplay-guard-config", {
        detail: { allowed }
      })
    );
  }

  function processMedia(root, allowed) {
    if (allowed || !root) {
      return;
    }

    const nodes = [];
    if (root.matches?.("audio,video")) {
      nodes.push(root);
    }
    if (root.querySelectorAll) {
      nodes.push(...root.querySelectorAll("audio,video"));
    }

    for (const media of nodes) {
      media.autoplay = false;
      media.removeAttribute("autoplay");
    }
  }

  storageGet({ allowedHosts: [] })
    .then(({ allowedHosts }) => {
      const host = location.hostname;
      const allowed = Array.isArray(allowedHosts) && allowedHosts.includes(host);
      sendConfig(allowed);
      processMedia(document, allowed);

      document.addEventListener("DOMContentLoaded", () => processMedia(document.body, allowed), {
        once: true
      });

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            processMedia(node, allowed);
          }
        }
      }).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    })
    .catch((error) => console.warn(error.message));
})();
