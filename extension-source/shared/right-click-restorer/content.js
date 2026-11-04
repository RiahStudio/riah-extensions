(function () {
  // Same bypass as main-world.js. The style used to live there, so YouTube has
  // never received it; keep it that way rather than quietly changing what
  // YouTube's player gets.
  const host = location.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    return;
  }
  if (typeof isRiahQuietHost === "function" && isRiahQuietHost(host)) {
    return;
  }
  if (typeof isRiahEmbeddedThirdParty === "function" && isRiahEmbeddedThirdParty()) {
    return;
  }

  const STYLE_ID = "riah-right-click-restorer-style";
  const KEEP_ATTR = "data-riah-keep-select";
  // Never blanket-restore selection on every element. That makes booking CTAs selectable,
  // so a click turns into a text-selection drag and the control never fires.
  const STYLE_TEXT =
    ':not(a):not(button):not(input):not(select):not(textarea):not(summary):not(option):not(label):not(video):not(audio):not(canvas)' +
    ':not([role="button"]):not([role="link"]):not([role="tab"]):not([role="option"]):not([role="menuitem"])' +
    ':not([role="menuitemcheckbox"]):not([role="menuitemradio"]):not([role="slider"]):not([role="checkbox"])' +
    ':not([role="radio"]):not([role="switch"]):not([role="combobox"]):not([role="listbox"]):not([role="scrollbar"])' +
    ':not([role="spinbutton"]):not([role="treeitem"]):not([role="gridcell"]):not([contenteditable="true"])' +
    ':not([class*="btn"]):not([class*="button"]):not([class*="Button"]):not([class*="cta"])' +
    ':not([tabindex]):not([onclick]):not([style*="cursor:pointer"]):not([style*="cursor: pointer"])' +
    ':not([' + KEEP_ATTR + ']) {\n' +
    "        user-select: auto !important;\n" +
    "        -webkit-user-select: auto !important;\n" +
    "        -moz-user-select: auto !important;\n" +
    "      }\n" +
    "      img {\n" +
    "        -webkit-user-drag: auto !important;\n" +
    "        user-drag: auto !important;\n" +
    "      }";

  function injectStyle() {
    const root = document.head || document.documentElement;
    if (!root || document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    root.appendChild(style);
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function shouldKeepAuthorSelect(node) {
    if (!node || node.nodeType !== 1 || !node.tagName) {
      return false;
    }
    if (node.tagName.indexOf("-") !== -1) {
      return true;
    }
    try {
      if (typeof getComputedStyle === "function") {
        const style = getComputedStyle(node);
        if (style && String(style.cursor || "").toLowerCase() === "pointer") {
          return true;
        }
      }
    } catch (error) {
      void error;
    }
    return false;
  }

  function markKeepSelect(root) {
    if (!root) {
      return;
    }
    if (shouldKeepAuthorSelect(root) && !root.hasAttribute(KEEP_ATTR)) {
      root.setAttribute(KEEP_ATTR, "");
    }
    if (!root.querySelectorAll) {
      return;
    }
    const nodes = root.querySelectorAll("*");
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (shouldKeepAuthorSelect(node) && !node.hasAttribute(KEEP_ATTR)) {
        node.setAttribute(KEEP_ATTR, "");
      }
    }
  }

  function ensureKeepObserver() {
    if (ensureKeepObserver.started || typeof MutationObserver !== "function") {
      return;
    }
    const root = document.documentElement;
    if (!root) {
      return;
    }
    ensureKeepObserver.started = true;
    markKeepSelect(document);
    new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const added = mutations[i].addedNodes;
        if (!added) {
          continue;
        }
        for (let j = 0; j < added.length; j++) {
          markKeepSelect(added[j]);
        }
      }
    }).observe(root, { childList: true, subtree: true });
  }

  function apply(enabled) {
    if (!enabled) {
      removeStyle();
      return;
    }

    injectStyle();
    ensureKeepObserver();
    document.addEventListener("DOMContentLoaded", () => {
      injectStyle();
      markKeepSelect(document);
    }, { once: true });
  }

  chrome.storage.sync.get({ disabledHosts: [] }, ({ disabledHosts }) => {
    const enabled = !Array.isArray(disabledHosts) || !disabledHosts.includes(location.hostname);
    apply(enabled);
    document.dispatchEvent(
      new CustomEvent("riah-right-click-restorer-config", {
        detail: { enabled }
      })
    );
  });
})();
