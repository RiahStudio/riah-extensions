(function () {
  function translateValue(text) {
    let current = text;
    for (const [jp, en] of Object.entries(window.TRANSLATIONS || {})) {
      if (current.includes(jp)) {
        current = current.split(jp).join(en);
      }
    }
    return current;
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const next = translateValue(node.nodeValue);
      if (next !== node.nodeValue) {
        node.nodeValue = next;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    if (typeof node.value === "string") {
      const next = translateValue(node.value);
      if (next !== node.value) {
        node.value = next;
      }
    }

    for (const attr of ["title", "aria-label"]) {
      const value = node.getAttribute(attr);
      if (!value) {
        continue;
      }
      const next = translateValue(value);
      if (next !== value) {
        node.setAttribute(attr, next);
      }
    }
  }

  function walk(root) {
    translateNode(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      translateNode(node);
    }
  }

  walk(document.body);
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        walk(node);
      }
      if (mutation.type === "characterData" && mutation.target) {
        translateNode(mutation.target);
      }
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true
  });
})();
