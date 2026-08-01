# Spec: paste-guard

Prevents sites from blocking paste, copy, and context-menu behavior in input fields.

## What it does

Intercepts `paste`, `copy`, `cut`, `contextmenu`, and `keydown` events on input fields and **stops propagation of preventDefault()**. Also re-enables `document.oncopy`, `document.onpaste`, `document.oncut` if they've been overridden.

## Target folder

`shared/paste-guard/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — the whole extension, basically
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>` — paste-blocking happens on login/banking/paywalled sites mostly but users expect it everywhere.
- **No other permissions.** No popup, no background script.

## Implementation

```js
// content.js
const EVENTS = ["paste", "copy", "cut", "contextmenu", "dragstart", "selectstart"];

for (const name of EVENTS) {
  document.addEventListener(name, (e) => {
    // Stop site's own handlers from preventing the default.
    e.stopImmediatePropagation();
  }, { capture: true });
}

// Null out inline handlers some sites set.
const props = ["oncopy", "onpaste", "oncut", "oncontextmenu", "ondragstart", "onselectstart"];
function scrub(root) {
  for (const p of props) {
    try { root[p] = null; } catch {}
  }
}
scrub(document);
scrub(document.body);

// Re-scrub on DOM changes (some sites re-set these).
new MutationObserver(() => scrub(document.body)).observe(document.documentElement, {
  subtree: true, childList: true, attributes: true, attributeFilter: props,
});
```

## Manifest

`content_scripts` with `"run_at": "document_start"` and `"all_frames": true`. That's critical — paste blocking often lives in iframes.

## Acceptance criteria

- Test on a known paste-blocking site (banks, PayPal login, some government portals). Pasting into password field works.
- Test on a right-click-blocked site. Right-click menu appears.
- Extension has zero `host_permissions` in its manifest — only `content_scripts`.
