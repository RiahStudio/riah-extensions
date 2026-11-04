# Spec: right-click-restorer

Force-enables right-click, copy, selection, and image drag on sites that block them.

## What it does

Strips the JavaScript hooks sites use to disable right-click and copying. Overlaps with `paste-guard` but goes further by removing CSS `user-select: none`. It must never intercept ordinary pointer controls, and it must never force selection on buttons, links, sliders, or booking widgets.

The MAIN-world capture listeners and inline-handler observer live in `shared/page-unblock/`, shared with Paste Guard. Both extensions stay installable on their own; when both are present, the page still gets one observer.

YouTube is a built-in bypass. The extension exits before installing any listener, style, or observer on `youtube.com` and its subdomains because the player is a high-frequency interactive application.

WhatsApp Web is a built-in bypass, same idea as YouTube. Do not install listeners or the shared observer on `*.whatsapp.com` or `*.whatsapp.net`.

Only stop context-menu and selection events when the page is actually blocking them. Stay off the shared quiet-host list (and YouTube). Load `quiet-hosts/index.js` first.

## Target folder

`shared/right-click-restorer/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `main-world.js` — YouTube bypass, then `page-unblock.install("right-click-restorer")`
- `content.js` — isolated-world CSS (`user-select`) and per-host enable flag
- `popup.html` + `popup.js` — per-site enable/disable toggle
- `background.js` — tracks per-site settings
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>`, `all_frames: true`, `run_at: document_start`
- `storage` — per-site toggle
- `activeTab` — for popup to read current URL host

## Implementation

MAIN world loads `page-unblock/main-world.js` then `main-world.js`. Isolated world injects the selection CSS (page CSP cannot block a content-script style). Per-host disable is a CustomEvent into the shared unblock so listeners become no-ops when this extension is the only owner.

## Popup

- Toggle: "Force right-click on this site: ON/OFF"
- Saves to `chrome.storage.sync` keyed by host. Content script reads settings early in `document_start` and no-ops if disabled.

## Acceptance criteria

- On a site that disables right-click (e.g. many stock-photo sites), right-click menu works after extension is enabled.
- Toggle off for a specific host → site's own right-click blocking resumes (when Paste Guard is not also installed).
- Text selection with mouse drag works on sites that previously blocked it.
- Normal `mousedown`, click, drag, slider, and seek-bar interactions are never intercepted.
- The extension never replaces `Event.prototype.preventDefault` or forces `pointer-events` CSS.
- On YouTube, the extension installs nothing and leaves the player completely untouched.
- Together with Paste Guard, the page has exactly one MAIN-world MutationObserver scrubbing inline handler props.
