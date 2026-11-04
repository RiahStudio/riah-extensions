# Changelog

## 2026-09-18

- Right Click Restorer no longer uses `* { user-select: auto }`. Controls keep the page's `user-select: none`.
- page-unblock latches only matching clipboard / context-menu handlers, so booking widgets keep drag and click.


## 2026-09-06

- Shared `page-unblock` library: one MAIN-world MutationObserver for Paste Guard
  and Right Click Restorer. Paste Guard no longer assigns to
  `Event.prototype.preventDefault`. Clipboard shortcuts are only intercepted
  when the page is blocking paste.
- English Search content script returns before any `history` patch on hosts
  `rewrite()` already skips (Accounts, Gmail, Docs, and the rest).
- Cookie Quiet is in the Brave daily installer again.

## 2026-07-22

- Added Riah Volume Boost as a Chromium/Brave-first tab-audio booster with no
  host permissions.
- Prepared the extension source tree for public release with public-safe slugs,
  Riah product names, official icon assets, and shared support links.
- Added static checks for public names, homepage links, support-link wiring,
  minimum permissions, and unsafe code patterns.
- Reduced YouTube startup churn in Riah YouTube Controls and Riah YouTube
  Quality.

## 2026-05-19

- Added the shared settings module at `shared/settings/`.
- Extended `build.js` so shared library folders are vendored into extensions
  that reference them.
- Added unit coverage for the shared settings adapters and migration helpers.
