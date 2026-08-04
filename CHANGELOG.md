# Changelog

## 2026-08-04 - Inventory + replace triage

- docs/BUILD-YOUR-OWN.md now covers the real loop: scan installed extensions, triage replace/keep/skip, then rebuild from _template or an existing slug.
- Added scripts/inventory-extensions.mjs to read Brave/Chrome/Edge profiles on disk (no management permission).
- README points agents at inventory first, not just "copy the template."

## 2026-08-04 - Buy me a coffee on the README

- Public README now carries a quiet Buy me a coffee link to https://buymeacoffee.com/riahstudio (popup footers already had it).

## 2026-08-04 - Public pitch: copy these, Brave first

- README now leads with the Levels warning about store extensions getting sold, and the real ask: point an agent at the source and rebuild your own.
- Pink extension icons sit near the top of the README so the set reads as a visual product, not a file dump.
- Brave is named as the tested daily driver. Chrome and Firefox stay source-available until those browsers are loaded and checked.

## 2026-08-04 - Shorts open paused

- Riah YouTube Controls 0.3.1 applies "Open videos paused" to `/shorts` as well as `/watch`.
- Shorts often re-fire `play` after one pause; the hold now keeps pausing until you touch the player (or the short hold window ends), instead of spending itself on the first attempt.
- Autonav + captions prefs stay watch-page only — Shorts do not use that control.

## 2026-07-29 - Per-browser sets, own icons, and Edge packages

- **Every extension now has its own glyph.** The old mapping reused a handful of
  generic Riah product marks, which is why every card in the browser looked
  identical. The Riah Icon Pack is filed at `docs/brand/riah-icon-pack/` and
  `scripts/render-icons.js` rasterises 32/128/512 PNGs plus `source.svg` by
  driving headless Edge over CDP, so the project stays dependency-free. The
  script fails if a built extension has no glyph assigned.
- **Two extensions came back, scoped to where they are actually needed.**
  `cookie-quiet` ships to Chrome and Edge, which have no native consent-notice
  blocking; Brave's Shields and Firefox's own banner blocker cover it elsewhere.
  `tab-sleeper` ships to Firefox only, which unloads tabs solely under memory
  pressure with no idle timer, while Chrome Memory Saver and Edge Sleeping Tabs
  already do the job.
- Targeting is expressed by which manifest an extension ships, so the build
  enforces it. The static audit gained `chromiumOnly` / `firefoxOnly` and now
  asserts both directions, so a stray manifest cannot re-widen a set silently.
- **Edge packages.** Chrome, Edge and Brave take the byte-identical Chromium
  build, so `dist/` still has two trees, not four. `package:public` now cuts a
  third set of store zips from the same Chromium output: 12 Chrome, 12 Edge,
  11 Firefox.
- Correction to the 2026-07-29 retirement note: the deleted extensions were never
  tracked under `extension-source/shared/`. Their source survives in
  `public-export/riah-extensions/extension-source/`, which is where these two
  were recovered from.

## 2026-07-29 - Right Click Restorer 0.2.2 works on CSP-locked pages

- The selection and image-drag CSS was injected from `main-world.js`, which runs
  in the page's own world and is therefore subject to the page's
  Content-Security-Policy. On strict sites - Gumroad and Stripe were the live
  examples - the style was blocked outright, so right-click and selection were
  never actually restored there. Brave surfaced it as an extension error.
- The style moved to `content.js`, which runs in the isolated content-script
  world and is exempt from page CSP. No new permissions.
- The YouTube bypass was mirrored into `content.js`. The style previously lived
  behind main-world's early return, so YouTube has never received it, and this
  keeps it that way rather than quietly changing what the player gets.
- `main-world.js` no longer re-injects a style on every mutation batch.
- New browser fixture: a CSP-locked page must end up with selection actually
  restored, asserted on the computed style rather than on the element existing.

## 2026-07-29 - The verifier no longer fails on entries Brave cannot show

- A dead unpacked entry - one whose folder no longer exists - stays in Brave's
  `Secure Preferences` forever. Brave loads no code for it and draws no card, so
  there is no Remove button and no way to clear it from the UI. Twenty such
  entries had accumulated across the slug rename and the retirement cut, and the
  verifier was failing on all of them, demanding removals that are impossible.
- `Get-LegacyRiahEntries` now records `Removable` from whether the folder still
  exists. `Verify` fails only on entries that actually load; the rest are listed
  as inert leftovers with an explanation.
- One real exception is called out: a folder deleted while Brave is already
  running keeps its card until the next restart, and that card should be removed
  while it is still there.

## 2026-07-29 - Retired six extensions the browser now does natively

- Deleted `cookie-quiet`, `tab-sleeper`, `site-zoom`, `zoom-baseline`,
  `page-translator`, and `selection-translator`. Brave and Firefox both ship
  cookie-notice blocking, idle-tab unloading, per-site zoom, a default zoom
  preference, and page/selection translation. A rebuilt extension we have to
  maintain and trust is worse than a browser feature that is already there.
- Google Translate is now retired outright rather than replaced by a Riah
  extension, since Brave translates natively.
- Riah Volume Boost is Chrome-only. Its Firefox manifest was a stub without
  `tabCapture` or `offscreen`, so the Firefox build could never boost anything.
  The build now reports 11 Chrome / 10 Firefox, and the static audit asserts a
  Chrome-only extension ships no Firefox manifest.
- The Brave daily set is 11. `brave-migration.json` records why each retired
  extension went, and still flags the old pre-rename Brave entries for removal.
- Removed the matching specs, expectations, unit tests, browser fixtures, and
  fixture routes. Full suite green.

## 2026-07-29 - YouTube watch pages open paused

- Riah YouTube Controls 0.3.0 adds an "Open videos paused" preference, on by
  default: a watch page holds its opening frame instead of starting playback.
- The hold is deliberately narrow so it cannot repeat the 0.1.0 autoplay
  regressions - at most one pause per watch page, only within the first two
  seconds of the video and twenty seconds of the page, never after the user has
  touched the player, and with no observer, style change, or pointer handling.
- Its content script now runs at `document_start` so the hold is armed before
  YouTube's player can begin playing.
- Browser fixtures cover the hold, the single-pause rule, a mid-video resume
  that must never be paused, and the preference switched off.

## 2026-07-22 - Public publish-prep pass

- Added Riah Volume Boost as a Chromium/Brave-first replacement for the disabled
  Volume Booster and Volume Master extensions.
- Renamed extension source slugs and visible names to public-safe `Riah ...`
  product names.
- Added shared, unobtrusive `Riah Studio` and `Buy me a coffee` links to
  existing popup/options pages.
- Added Riah Studio manifest homepages and static guardrails for public names,
  support-link wiring, minimum permissions, and unsafe code patterns.
- Filed the official Riah icon system into `docs/brand/` and applied official
  Riah PNG/SVG assets to all publishable extension folders.
- Added privacy, security, support, publishing, store-listing, packaging, and
  public-export documentation for a clean GitHub release path.

## 2026-07-22 - Reduced YouTube startup churn

- Riah YouTube Controls now uses a bounded watch-page retry loop instead of a
  page-wide `MutationObserver`, reducing work during YouTube startup.
- Riah YouTube Quality now polls only on `/watch` pages and clears stale retry
  timers before starting a new one.
- Riah Site Zoom no longer forces unsaved YouTube tabs to 100%; explicit saved
  YouTube zoom rules still persist and reapply.

## 2026-07-17 - Hardened YouTube and pointer behavior

- Riah Autoplay Guard exits before installing wrappers or observers on YouTube.
- Riah Right Click Restorer exits before installing listeners, styles, or
  observers on YouTube.
- Removed pointer interception that could interfere with sliders, seek bars, and
  ordinary clicks.
- Added browser smoke coverage for seek-bar and pointer interactions.

## 2026-07-16 - Brave testing and migration helpers

- Added local Brave launchers for checking or manually testing the current
  Chromium build in a dedicated profile.
- Added backup-first local migration helpers for the existing Brave daily-use
  profile.

## 2026-07-15 - Recovered and hardened the implemented set

- Root build/test commands now target the implemented 16-extension source tree.
- Hardened Library Search URL handling, Timeline Exporter reply filtering, and
  Site Zoom domain handling.
- Added static safety, background unit, and browser smoke coverage.
