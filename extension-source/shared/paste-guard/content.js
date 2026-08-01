(function () {
  if (window.__riahDontFuckWithPasteInstalled) {
    return;
  }
  window.__riahDontFuckWithPasteInstalled = true;

  const BLOCK_EVENTS = [
    "paste",
    "copy",
    "cut",
    "contextmenu",
    "dragstart",
    "selectstart"
  ];
  const INLINE_PROPS = [
    "oncopy",
    "onpaste",
    "oncut",
    "oncontextmenu",
    "ondragstart",
    "onselectstart"
  ];
  const originalPreventDefault = Event.prototype.preventDefault;

  Event.prototype.preventDefault = function () {
    if (BLOCK_EVENTS.includes(this.type)) {
      return;
    }
    return originalPreventDefault.apply(this, arguments);
  };

  for (const name of BLOCK_EVENTS) {
    document.addEventListener(
      name,
      (event) => {
        event.stopImmediatePropagation();
      },
      true
    );
  }

  document.addEventListener(
    "keydown",
    (event) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = (event.key || "").toLowerCase();
      if (["a", "c", "v", "x"].includes(key)) {
        event.stopImmediatePropagation();
      }
    },
    true
  );

  function scrubNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) {
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
    if (!root) {
      return;
    }

    if (root.nodeType === Node.DOCUMENT_NODE) {
      scrubNode(root.documentElement);
      scrubNode(root.body);
      return;
    }

    scrubNode(root);
    if (root.querySelectorAll) {
      for (const element of root.querySelectorAll("*")) {
        scrubNode(element);
      }
    }
  }

  scrubTree(document);
  document.addEventListener("DOMContentLoaded", () => scrubTree(document), {
    once: true
  });

  new MutationObserver((mutations) => {
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
})();
