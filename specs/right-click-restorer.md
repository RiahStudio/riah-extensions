# Spec: right-click-restorer

Force-enables right-click, copy, selection, and image drag on sites that block them.

## What it does

Strips the JavaScript hooks sites use to disable right-click and copying. Overlaps with `paste-guard` but goes further by removing CSS `user-select: none`. It must never intercept ordinary pointer controls.

YouTube is a built-in bypass. The extension exits before installing any listener, style, or observer on `youtube.com` and its subdomains because the player is a high-frequency interactive application.

## Target folder

`shared/right-click-restorer/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js`
- `popup.html` + `popup.js` — per-site enable/disable toggle
- `background.js` — tracks per-site settings
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>`, `all_frames: true`, `run_at: document_start`
- `storage` — per-site toggle
- `activeTab` — for popup to read current URL host

## Implementation

```js
// content.js
// 1. Block only the events sites use to disable right-click/copy.
const BLOCK = ["contextmenu", "selectstart", "copy", "cut"];
for (const name of BLOCK) {
  window.addEventListener(name, (e) => e.stopImmediatePropagation(), true);
}

// 2. Inject CSS that forces selection.
const style = document.createElement("style");
style.textContent = `
  * { user-select: auto !important; -webkit-user-select: auto !important; -moz-user-select: auto !important; }
  img { -webkit-user-drag: auto !important; }
`;
(document.head || document.documentElement).appendChild(style);

// 3. Null out inline handlers.
const props = ["oncontextmenu", "onselectstart", "oncopy", "oncut"];
function scrub(root) {
  for (const p of props) { try { root[p] = null; } catch {} }
}
scrub(document);
scrub(document.body);
new MutationObserver(() => scrub(document.body)).observe(document.documentElement, {
  subtree: true, attributes: true, attributeFilter: props,
});
```

## Popup

- Toggle: "Force right-click on this site: ON/OFF"
- Saves to `chrome.storage.sync` keyed by host. Content script reads settings early in `document_start` and no-ops if disabled.

## Acceptance criteria

- On a site that disables right-click (e.g. many stock-photo sites), right-click menu works after extension is enabled.
- Toggle off for a specific host → site's own right-click blocking resumes.
- Text selection with mouse drag works on sites that previously blocked it.
- Normal `mousedown`, click, drag, slider, and seek-bar interactions are never intercepted.
- The extension never replaces `Event.prototype.preventDefault` or forces `pointer-events` CSS.
- On YouTube, the extension installs nothing and leaves the player completely untouched.
