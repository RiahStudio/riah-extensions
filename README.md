# Riah Extensions

## Direct answer

**Riah Extensions** is a public set of small browser extensions from Riah Studio for Chrome, Edge, Brave, and Firefox. Each extension does one job (autoplay guard, paste restore, YouTube controls, and similar), uses minimal permissions, and ships without telemetry or remote config. Limitations: not every extension ships on every browser when the browser already covers that job natively.


Small, readable browser extensions from Riah Studio. Each extension is scoped to
one job, uses minimal permissions, and avoids telemetry, remote code, and remote
configuration.

## Publishable Extensions

Chrome, Edge and Brave are all Chromium and take the byte-identical package, so
there is one Chromium build and one Firefox build — not four. Each store still
gets its own zip under `release/`.

| Extension | Source slug | Browsers | What it does |
| --- | --- | --- | --- |
| Riah Autoplay Guard | `autoplay-guard` | Chrome, Edge, Firefox | Blocks unwanted media autoplay outside YouTube. |
| Riah Cookie Quiet | `cookie-quiet` | Chrome, Edge | Dismisses or rejects cookie consent banners. |
| Riah English Search | `english-search` | Chrome, Edge, Firefox | Keeps Google, YouTube, and store searches in English instead of the local language. |
| Riah Library Search | `library-search` | Chrome, Edge, Firefox | Opens a configured library/catalog search from supported book pages. |
| Riah Paste Guard | `paste-guard` | Chrome, Edge, Firefox | Restores paste in fields where websites try to block it. |
| Riah Right Click Restorer | `right-click-restorer` | Chrome, Edge, Firefox | Restores right-click, copy, selection, and image drag behavior. |
| Riah Tab Anchor | `tab-anchor` | Chrome, Edge, Firefox | Moves accidentally detached tabs back to their original window. |
| Riah Tab Sleeper | `tab-sleeper` | Firefox | Discards idle tabs to free memory, on a timer. |
| Riah Tenhou English | `tenhou-english` | Chrome, Edge, Firefox | Adds English UI labels to Tenhou. |
| Riah Thai Year Helper | `thai-year-helper` | Chrome, Edge, Firefox | Adds Gregorian year context beside Thai Buddhist Era years. |
| Riah Timeline Exporter | `timeline-exporter` | Chrome, Edge, Firefox | Exports visible X/Twitter posts to a local CSV file. |
| Riah Volume Boost | `volume-boost` | Chrome, Edge | Boosts or mutes current-tab audio. |
| Riah YouTube Controls | `youtube-controls` | Chrome, Edge, Firefox | Opens watch pages paused and keeps autoplay and captions in the preferred state. |
| Riah YouTube Resume | `youtube-resume` | Chrome, Edge, Firefox | Puts you back where you were in a YouTube video after the tab is discarded or reopened. |
| Riah YouTube Quality | `youtube-quality` | Chrome, Edge, Firefox | Sets YouTube playback quality up to a preferred ceiling. |

## Two extensions ship to some browsers and not others

An extension is only worth installing where the browser does not already do the
job. Two of the set are therefore deliberately partial, expressed by which
manifests they ship (`manifest.chrome.json` / `manifest.firefox.json`) — the
build and the static audit both enforce it.

| Extension | Chrome / Edge | Brave | Firefox |
| --- | --- | --- | --- |
| **Riah Cookie Quiet** | **ships** — no native consent-notice blocking | not needed; Shields does it | not needed; Firefox's own banner blocker is one toggle in Settings → Privacy & Security |
| **Riah Tab Sleeper** | not needed; Chrome Memory Saver and Edge Sleeping Tabs | not needed; Memory Saver | **ships** — Firefox unloads only under memory pressure, with no idle timer |
| **Riah Volume Boost** | **ships** | ships | not possible; Firefox has no `tabCapture` or offscreen API |

Brave takes the Chromium package minus Cookie Quiet; its exact daily set lives in
`Brave Migration/brave-migration.json`.

## Retired 2026-07-29 — the browser now does these itself

Deleted once every target browser shipped the same behavior natively. Rebuilding
them would only add a second thing to maintain and trust.

| Retired | Replaced by, everywhere |
| --- | --- |
| `site-zoom` | Native per-site zoom |
| `zoom-baseline` | The browser's own default zoom preference |
| `page-translator` | Native page translation |
| `selection-translator` | Native translation, including selected text |

Their source is preserved under `public-export/riah-extensions/extension-source/`
if any of that ever regresses.

## Quick Start

```powershell
npm test
npm run build
npm run package:public
```

Build output is generated under `extension-source/dist/`. Store-ready
ZIP files are generated under `release/`.

For a clean public GitHub seed, run:

```powershell
npm run export:public
```

That writes `public-export/riah-extensions/` with only public source, tests,
docs, brand assets, and release scripts. Use that export as the public repo
source instead of publishing this full local workspace.

## Local Brave Check

Run `Start All Riah Extensions in Brave.bat --check` to rebuild the Chromium
packages and verify the current load-unpacked set without opening Brave.

Double-click `Start All Riah Extensions in Brave.bat` to open the current
Chromium build in a dedicated disposable Brave profile for manual testing.

## Docs

- `PRIVACY.md` covers extension data handling.
- `SECURITY.md` covers security reporting and maintenance expectations.
- `SUPPORT.md` covers support links and the small donation link policy.
- `docs/PUBLISHING.md` covers packaging and store review prep.
- `docs/STORE-LISTINGS.md` contains first-pass listing copy.
- `docs/PUBLIC-NAMING.md` records the public naming rules.
- `docs/brand/` contains the official Riah icon system.
