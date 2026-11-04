# Spec: paste-guard

Prevents sites from blocking paste, copy, and context-menu behavior in input fields.

## What it does

Neutralizes the page's own blocking handlers for `paste`, `copy`, `cut`, `contextmenu`, `dragstart`, and `selectstart` with a capture-phase listener plus inline `on*` scrubbing. Does **not** replace `Event.prototype.preventDefault` or any other built-in prototype method. Ctrl/Cmd + A/C/V/X is only intercepted when the page is actually blocking the clipboard (inline handlers or `user-select: none`), so in-app shortcuts on Gmail and web editors keep working.

Shares one MAIN-world MutationObserver with `right-click-restorer` via `shared/page-unblock/`. Either extension still works when the other is not installed.

## Target folder

`shared/paste-guard/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — installs the shared unblock under the `paste-guard` owner id
- `../page-unblock/main-world.js` — vendored at build time
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>` — paste-blocking happens on login/banking/paywalled sites mostly but users expect it everywhere.
- **No other permissions.** No popup, no background script.

## Implementation

```js
// content.js (MAIN world)
window.__riahPageUnblock.install("paste-guard");
```

The shared script listens on `window` in capture so it runs before page handlers, scrubs inline `oncopy` / `onpaste` / `oncut` / `oncontextmenu` / `ondragstart` / `onselectstart`, and keeps a single `MutationObserver` for those attributes. Clipboard keydown is skipped unless the page looks like it is blocking paste.

## Manifest

`content_scripts` with `"run_at": "document_start"`, `"all_frames": true`, and `"world": "MAIN"`. That's critical — paste blocking often lives in iframes.

## Acceptance criteria

- Test on a known paste-blocking site (banks, PayPal login, some government portals). Pasting into a password field works.
- Test on a right-click-blocked site. Right-click menu appears.
- Google Docs / Notion / other editors that call `preventDefault` on paste to sanitise HTML do not double-paste.
- Gmail Ctrl/Cmd + A/C/V/X still reaches Gmail.
- Extension has zero `host_permissions` in its manifest — only `content_scripts`.
- Never assigns to a built-in prototype.
