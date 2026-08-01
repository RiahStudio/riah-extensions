(function () {
  const BE_YEAR = /\b(2[4-7]\d{2})\b(?!\s*\(\d{4}\))/g;

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

  function rewriteText(text, mode) {
    return text.replace(BE_YEAR, (year) => {
      const gregorian = String(parseInt(year, 10) - 543);
      return mode === "replace" ? gregorian : `${year} (${gregorian})`;
    });
  }

  function annotateNode(node, mode) {
    if (node.nodeType !== Node.TEXT_NODE) {
      return;
    }

    const parent = node.parentElement;
    if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) {
      return;
    }

    const next = rewriteText(node.nodeValue, mode);
    if (next !== node.nodeValue) {
      node.nodeValue = next;
    }
  }

  function walk(root, mode) {
    if (!root) {
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }
    for (const textNode of nodes) {
      annotateNode(textNode, mode);
    }
  }

  storageGet({ disabledHosts: [], modeByHost: {} })
    .then(({ disabledHosts, modeByHost }) => {
      const host = location.hostname;
      if (Array.isArray(disabledHosts) && disabledHosts.includes(host)) {
        return;
      }

      const mode = modeByHost[host] || "annotate";
      walk(document.body, mode);

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              walk(node, mode);
            } else if (node.nodeType === Node.TEXT_NODE) {
              annotateNode(node, mode);
            }
          }
        }
      }).observe(document.documentElement, {
        subtree: true,
        childList: true
      });
    })
    .catch((error) => console.warn(error.message));
})();
