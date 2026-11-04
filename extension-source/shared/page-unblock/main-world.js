/**
 * Shared MAIN-world clipboard / context-menu unblock.
 *
 * Paste Guard and Right Click Restorer both inject this file at
 * document_start. The first copy to run owns the capture listeners and the
 * single MutationObserver that scrubs inline handler props. Later copies
 * reuse the same window API, so a page never gets two observers even when
 * both extensions are installed. Each extension still works on its own.
 *
 * Does not assign to any built-in prototype.
 *
 * Only stop the event type the page is actually blocking. A footer
 * oncontextmenu must not latch dragstart/selectstart for the whole page —
 * that is what broke booking widgets and other ordinary controls.
 */
(function (global) {
  "use strict";

  const host = String((global.location && global.location.hostname) || "").toLowerCase();
  function isQuiet(host) {
    if (typeof global.isRiahQuietHost === "function") {
      return global.isRiahQuietHost(host);
    }
    return (
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com") ||
      host === "whatsapp.net" ||
      host.endsWith(".whatsapp.net")
    );
  }
  if (isQuiet(host)) {
    return;
  }
  if (typeof global.isRiahEmbeddedThirdParty === "function" && global.isRiahEmbeddedThirdParty()) {
    return;
  }

  if (global.__riahPageUnblock && typeof global.__riahPageUnblock.install === "function") {
    return;
  }

  const BLOCK_EVENTS = [
    "paste",
    "copy",
    "cut",
    "contextmenu",
    "dragstart",
    "selectstart"
  ];
  const EVENT_PROP = {
    paste: "onpaste",
    copy: "oncopy",
    cut: "oncut",
    contextmenu: "oncontextmenu",
    dragstart: "ondragstart",
    selectstart: "onselectstart"
  };
  const PAGE_WIDE_PROPS = {
    onpaste: true,
    oncopy: true,
    oncut: true,
    oncontextmenu: true
  };
  const CLIPBOARD_TYPES = {
    paste: true,
    copy: true,
    cut: true
  };
  const INLINE_PROPS = [
    "onpaste",
    "oncopy",
    "oncut",
    "oncontextmenu",
    "ondragstart",
    "onselectstart"
  ];
  const INTERACTIVE_TAGS = {
    A: true,
    BUTTON: true,
    INPUT: true,
    SELECT: true,
    TEXTAREA: true,
    SUMMARY: true,
    LABEL: true,
    OPTION: true,
    VIDEO: true,
    AUDIO: true,
    CANVAS: true
  };
  const INTERACTIVE_ROLES = {
    button: true,
    link: true,
    tab: true,
    option: true,
    menuitem: true,
    menuitemcheckbox: true,
    menuitemradio: true,
    slider: true,
    checkbox: true,
    radio: true,
    switch: true,
    combobox: true,
    listbox: true,
    scrollbar: true,
    spinbutton: true,
    treeitem: true,
    gridcell: true
  };
  const CLIPBOARD_KEYS = {
    a: true,
    c: true,
    v: true,
    x: true
  };

  const owners = Object.create(null);
  const sawInlineFor = Object.create(null);
  let listenersBound = false;
  let observerStarted = false;
  let pageLocksTextSelection = false;
  let scrubbing = false;

  function isElement(node) {
    return !!(node && node.nodeType === 1);
  }

  function isActive() {
    for (const id in owners) {
      if (owners[id]) {
        return true;
      }
    }
    return false;
  }

  function nodeTag(node) {
    return String((node && node.tagName) || "").toUpperCase();
  }

  function nodeRole(node) {
    if (!isElement(node) || !node.getAttribute) {
      return "";
    }
    return String(node.getAttribute("role") || "").toLowerCase();
  }

  function isInteractiveElement(node) {
    if (!isElement(node)) {
      return false;
    }
    if (INTERACTIVE_TAGS[nodeTag(node)]) {
      return true;
    }
    if (INTERACTIVE_ROLES[nodeRole(node)]) {
      return true;
    }
    if (node.isContentEditable) {
      return true;
    }
    const className = String(
      (node.getAttribute && node.getAttribute("class")) ||
        (typeof node.className === "string" ? node.className : "") ||
        ""
    ).toLowerCase();
    if (
      className.indexOf("btn") !== -1 ||
      className.indexOf("button") !== -1 ||
      className.indexOf("cta") !== -1
    ) {
      return true;
    }
    if (node.getAttribute && node.getAttribute("tabindex") != null) {
      return true;
    }
    if (typeof node.onclick === "function") {
      return true;
    }
    if (node.getAttribute && node.getAttribute("onclick") != null) {
      return true;
    }
    if (nodeTag(node).indexOf("-") !== -1) {
      return true;
    }
    try {
      if (typeof global.getComputedStyle === "function") {
        const style = global.getComputedStyle(node);
        if (style && String(style.cursor || "").toLowerCase() === "pointer") {
          return true;
        }
      }
    } catch (error) {
      void error;
    }
    return false;
  }

  function isInsideInteractive(node) {
    let current = node;
    while (current) {
      if (isInteractiveElement(current)) {
        return true;
      }
      current = current.parentElement || current.parentNode;
      if (current && current.nodeType !== 1) {
        current = current.parentElement;
      }
    }
    return false;
  }

  function nodeHasInlineProp(node, prop) {
    if (!isElement(node) || !prop) {
      return false;
    }
    if (typeof node[prop] === "function") {
      return true;
    }
    if (node.getAttribute && node.getAttribute(prop) != null) {
      return true;
    }
    return false;
  }

  function nodeHasInlineBlock(node) {
    if (!isElement(node)) {
      return false;
    }
    for (let i = 0; i < INLINE_PROPS.length; i++) {
      if (nodeHasInlineProp(node, INLINE_PROPS[i])) {
        return true;
      }
    }
    return false;
  }

  function nodeHasUserSelectNone(node) {
    if (!isElement(node) || typeof global.getComputedStyle !== "function") {
      return false;
    }
    try {
      const style = global.getComputedStyle(node);
      const value = String(
        (style && (style.userSelect || style.webkitUserSelect)) || ""
      ).toLowerCase();
      return value === "none";
    } catch (error) {
      void error;
      return false;
    }
  }

  function documentHasInlineProp(prop) {
    const doc = global.document;
    return !!(doc && prop && typeof doc[prop] === "function");
  }

  function markInline(prop) {
    if (!prop) {
      return;
    }
    sawInlineFor[prop] = true;
    if (prop === "onselectstart") {
      pageLocksTextSelection = true;
    }
  }

  function pageIsBlockingEvent(event) {
    const type = event && event.type;
    const prop = EVENT_PROP[type];

    if (CLIPBOARD_TYPES[type]) {
      if (sawInlineFor.onpaste || sawInlineFor.oncopy || sawInlineFor.oncut) {
        return true;
      }
      if (
        documentHasInlineProp("onpaste") ||
        documentHasInlineProp("oncopy") ||
        documentHasInlineProp("oncut")
      ) {
        return true;
      }
    }
    if (prop && sawInlineFor[prop] && PAGE_WIDE_PROPS[prop]) {
      return true;
    }
    if (documentHasInlineProp(prop)) {
      return true;
    }

    let node = event && event.target;
    let sawMatchingInline = false;
    let sawSelectionLock = false;
    while (node) {
      if (nodeHasInlineProp(node, prop)) {
        sawMatchingInline = true;
      }
      if (nodeHasUserSelectNone(node)) {
        sawSelectionLock = true;
        if (nodeTag(node) === "HTML" || nodeTag(node) === "BODY") {
          pageLocksTextSelection = true;
        }
      }
      node = node.parentElement || node.parentNode;
      if (node && node.nodeType !== 1) {
        node = node.parentElement;
      }
    }

    if (sawMatchingInline) {
      return true;
    }

    if (type === "selectstart" || type === "copy" || type === "cut") {
      if (isInsideInteractive(event && event.target)) {
        return false;
      }
      return sawSelectionLock || pageLocksTextSelection;
    }

    return false;
  }

  function keyType(key) {
    if (key === "v") {
      return "paste";
    }
    if (key === "c") {
      return "copy";
    }
    if (key === "x") {
      return "cut";
    }
    return "selectstart";
  }

  function scrubNode(node) {
    if (!isActive() || !isElement(node)) {
      return;
    }
    if (!nodeHasInlineBlock(node)) {
      return;
    }
    for (let i = 0; i < INLINE_PROPS.length; i++) {
      const prop = INLINE_PROPS[i];
      if (!nodeHasInlineProp(node, prop)) {
        continue;
      }
      markInline(prop);
      try {
        node[prop] = null;
      } catch (error) {
        void error;
      }
      if (node.removeAttribute) {
        node.removeAttribute(prop);
      }
    }
  }

  function scrubTree(root) {
    if (!isActive() || !root) {
      return;
    }

    if (root.nodeType === 9) {
      const start = root.documentElement || root.body;
      if (!start) {
        return;
      }
      scrubNode(start);
      if (start.querySelectorAll) {
        const elements = start.querySelectorAll("*");
        for (let i = 0; i < elements.length; i++) {
          scrubNode(elements[i]);
        }
      }
      return;
    }

    scrubNode(root);
    if (root.querySelectorAll) {
      const elements = root.querySelectorAll("*");
      for (let i = 0; i < elements.length; i++) {
        scrubNode(elements[i]);
      }
    }
  }

  function blockEvent(event) {
    if (!isActive()) {
      return;
    }
    if (!pageIsBlockingEvent(event)) {
      return;
    }
    event.stopImmediatePropagation();
  }

  function onKeydown(event) {
    if (!isActive()) {
      return;
    }
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }
    const key = String(event.key || "").toLowerCase();
    if (!CLIPBOARD_KEYS[key]) {
      return;
    }
    if (!pageIsBlockingEvent({ type: keyType(key), target: event.target })) {
      return;
    }
    event.stopImmediatePropagation();
  }

  function ensureObserver() {
    if (observerStarted) {
      return;
    }
    const root = document.documentElement;
    if (!root || typeof MutationObserver !== "function") {
      return;
    }
    observerStarted = true;
    scrubTree(document);
    new MutationObserver((mutations) => {
      if (!isActive() || scrubbing) {
        return;
      }
      scrubbing = true;
      try {
        for (let i = 0; i < mutations.length; i++) {
          const mutation = mutations[i];
          if (mutation.type === "attributes") {
            scrubNode(mutation.target);
          }
          const added = mutation.addedNodes;
          if (!added) {
            continue;
          }
          for (let j = 0; j < added.length; j++) {
            scrubTree(added[j]);
          }
        }
      } finally {
        scrubbing = false;
      }
    }).observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: INLINE_PROPS
    });
  }

  function ensureListeners() {
    if (listenersBound) {
      return;
    }
    listenersBound = true;
    for (let i = 0; i < BLOCK_EVENTS.length; i++) {
      global.addEventListener(BLOCK_EVENTS[i], blockEvent, true);
    }
    global.addEventListener("keydown", onKeydown, true);
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        ensureObserver();
        scrubTree(document);
      },
      { once: true }
    );
  }

  function install(id) {
    if (!id) {
      return global.__riahPageUnblock;
    }
    owners[id] = true;
    ensureListeners();
    ensureObserver();
    return global.__riahPageUnblock;
  }

  function setEnabled(id, enabled) {
    if (!id) {
      return;
    }
    if (!(id in owners)) {
      if (!enabled) {
        return;
      }
      owners[id] = true;
      ensureListeners();
      ensureObserver();
      return;
    }
    owners[id] = !!enabled;
    if (isActive()) {
      scrubTree(document);
    }
  }

  global.__riahPageUnblock = {
    install,
    setEnabled
  };
})(typeof window !== "undefined" ? window : this);
