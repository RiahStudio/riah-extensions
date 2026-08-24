# Architecture

## One Source, Two Builds

```text
shared/<slug>/              source of truth
  manifest.chrome.json      Chromium Manifest V3 manifest
  manifest.firefox.json     Firefox Manifest V3 manifest
  background.js             service worker or background script, when needed
  content.js                content script, when needed
  popup.html/js/css         popup UI, when needed
  options.html/js           options UI, when needed
  icons/                    official Riah icon assets

dist/                       generated and gitignored
  chrome/<slug>/            load-unpacked Chromium package
    manifest.json           copied from manifest.chrome.json
  firefox/<slug>/           Firefox package (sign via AMO for a lasting install)
    manifest.json           copied from manifest.firefox.json
```

`build.js` walks `shared/`, copies each extension to `dist/chrome/<slug>/` and
`dist/firefox/<slug>/`, and renames the browser-specific manifest to
`manifest.json`.

## Shared Libraries

Folders under `shared/` without manifests are treated as shared libraries.
During build, each extension is scanned for path references to a shared library
folder. Referenced libraries are copied into that extension's generated package.

This keeps the source readable while still respecting browser-extension runtime
boundaries: packages cannot import code from sibling extension folders at
runtime.

## Chrome MV3 vs Firefox MV3

| Topic | Chromium | Firefox |
| --- | --- | --- |
| Background | `service_worker` | `background.scripts` or `service_worker` |
| Stable ID | Web Store ID after upload | `browser_specific_settings.gecko.id` |
| Browser APIs | `chrome.*` callbacks | `chrome.*` shim and `browser.*` promises |
| Signing | Store upload for public distribution | AMO signing for public distribution |

The extension source uses `chrome.*` APIs for the widest compatibility. When a
promise shape is helpful, wrap callback APIs locally instead of adding a browser
polyfill dependency.

## Permissions Policy

- Do not request `<all_urls>` unless an extension genuinely operates on all
  pages.
- Prefer `activeTab` for user-triggered page actions.
- Keep `host_permissions` distinct from `content_scripts.matches`.
- Opening a new URL with `chrome.tabs.create({ url })` does not require the
  `tabs` permission by itself.

## Icons

Public packages use official Riah icon assets. Each extension folder includes:

- `icons/32.png`
- `icons/128.png`
- `icons/512.png`
- `icons/source.svg`

The manifests reference the `32` and `128` PNG exports.

## Install Flow

Chromium browsers:

1. Open `chrome://extensions`, `brave://extensions`, or `edge://extensions`.
2. Enable Developer mode.
3. Load unpacked from `dist/chrome/<slug>/`.

Firefox (permanent):

1. Pack `dist/firefox/<slug>/` as an `.xpi` with `manifest.json` at the zip root.
2. Mozilla-sign it unlisted (On your own) at addons.mozilla.org/developers.
3. about:addons, gear, Install Add-on From File, pick the signed `.xpi`.
4. Do not use Load Temporary Add-on unless a short test is requested.

Brave/Chrome unpacked loads already persist across restart.

## Build Chain

The build and packaging scripts use Node.js standard-library APIs only. There is
no webpack, esbuild, TypeScript, or package-time dependency install.
