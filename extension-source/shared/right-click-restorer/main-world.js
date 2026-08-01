(function () {
  const host = location.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    return;
  }

  if (window.__riahAbsoluteRightClickInstalled) {
    return;
  }
  window.__riahAbsoluteRightClickInstalled = true;

  const BLOCK_EVENTS = [
    "contextmenu",
    "selectstart",
    "copy",
    "cut"
  ];
  const INLINE_PROPS = [
    "oncontextmenu",
    "onselectstart",
    "oncopy",
    "oncut"
  ];
  // The selection/drag CSS lives in content.js, not here. This script runs in
  // the page's own world, so a <style> element it appends is subject to the
  // page's Content-Security-Policy and gets blocked outright on strict sites
  // such as Gumroad and Stripe. Content scripts run in the isolated world and
  // are exempt from page CSP, so that is where the style belongs.
  let enabled = true;

  function scrubNode(node) {
    if (!enabled || !node || node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    for (const prop of INLINE_PROPS) {
      try {
        node[prop] = null;
      } catch (error) {
        void error;
      }
      node.removeAttribute(prop);
    }
  }

  function scrubTree(root) {
    if (!enabled || !root) {
      return;
    }

    if (root.nodeType === Node.ELEMENT_NODE) {
      scrubNode(root);
      if (root.querySelectorAll) {
        for (const element of root.querySelectorAll("*")) {
          scrubNode(element);
        }
      }
      return;
    }

    if (root.nodeType === Node.DOCUMENT_NODE) {
      scrubNode(root.documentElement);
      scrubNode(root.body);
    }
  }

  function blockEvent(event) {
    if (enabled) {
      event.stopImmediatePropagation();
    }
  }

  for (const name of BLOCK_EVENTS) {
    window.addEventListener(name, blockEvent, true);
  }

  scrubTree(document);

  document.addEventListener("DOMContentLoaded", () => {
    if (!enabled) {
      return;
    }
    scrubTree(document);
  });

  new MutationObserver((mutations) => {
    if (!enabled) {
      return;
    }

    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        scrubNode(mutation.target);
      }
      for (const node of mutation.addedNodes) {
        scrubTree(node);
      }
    }
  }).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: INLINE_PROPS
  });

  document.addEventListener("riah-right-click-restorer-config", (event) => {
    enabled = event.detail?.enabled !== false;
    if (enabled) {
      scrubTree(document);
    }
  });
})();
