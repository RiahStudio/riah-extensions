# Changelog

## 2026-08-24 - Background YouTube music keeps playing

- Riah YouTube Controls 0.3.4 still opens a fresh video paused, but once a tab is playing — or sitting in the background — the next song is left alone. Brave was putting the now-silent tab to sleep, which killed playlists.
- Riah YouTube Controls 0.3.5 keeps that listening session once a tab has already been playing, so the next song is not paused again.
- Riah YouTube Resume 0.1.2 still restores a discarded single video, but it does not jump when YouTube just advanced to the next song in the same tab.


## 2026-08-24 - Brave playlists no longer skip

- Riah YouTube Controls 0.3.3 still opens a single video paused, but a playlist, mix, or album keeps playing the next item even when YouTube is a moment late adding `list=` to the URL.
- Riah YouTube Resume 0.1.1 still restores a discarded tab, but it does not jump or pause a playlist or mix item from an old saved place.

## 2026-08-24 - Click starts the video

- Riah Autoplay Guard 0.2.4 lets a click start a video once it is ready, instead of ignoring that click until a short timer happened to line up. Page-load autoplay with no click is still blocked.


## 2026-08-24 - Music sites keep playing

- Riah Autoplay Guard 0.2.3 leaves dedicated music, podcast, and radio players alone (Spotify, Apple Music, Bandcamp, Mixcloud, and the rest of that set), so the next track can play. News sites stay blocked.


## 2026-08-24 - SoundCloud keeps playing

- Riah Autoplay Guard 0.2.2 leaves SoundCloud (including the player frame) alone, so the next track can play in Firefox the same way it already does on YouTube.

## 2026-08-19 - Playlists and music queues keep going

- Riah YouTube Controls 0.3.2 leaves playlist, mix, and album watch URLs alone: no open-paused hold, and the autoplay toggle is not forced off, so the next item can play.
- Riah Autoplay Guard 0.2.1 still blocks a site from starting media before you click, but after you start playback on a page the next track can play without another click.

## 2026-08-04 - Shorts open paused

- Riah YouTube Controls 0.3.1 applies "Open videos paused" to `/shorts` as well as `/watch`.
- Shorts often re-fire `play` after one pause; the hold now keeps pausing until you touch the player (or the short hold window ends), instead of spending itself on the first attempt.
- Autonav + captions prefs stay watch-page only — Shorts do not use that control.

## 2026-08-01 - Public GitHub release prepared

- Clean public export rebuilt; missing `cookie-quiet` / `tab-sleeper` specs restored.
- Fresh public release tree staged at `C:\Code\_publish\riah-extensions` (author Riah Harris, one clean commit). Private working repo stays private -- do not flip it.
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
