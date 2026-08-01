# Public Naming Pass

This pass moves the extension set toward public, store-safe names and
public-safe source slugs.

## Naming Rules

- Every visible product name starts with `Riah`.
- Names describe the user benefit, not the original extension being replaced.
- Avoid profanity, clone-style titles, and store-listing phrasing that sounds
  like a repackage.
- Keep popup support links small: `Riah Studio` and `Buy me a coffee` only.
- Extension icons should use the official Riah icon system in
  `docs/brand/riah-icon-system/icons/`. SVG files are the masters.

## Public Names

| Source slug | Public name |
| --- | --- |
| `right-click-restorer` | Riah Right Click Restorer |
| `autoplay-guard` | Riah Autoplay Guard |
| `thai-year-helper` | Riah Thai Year Helper |
| `cookie-quiet` | Riah Cookie Quiet |
| `tab-anchor` | Riah Tab Anchor |
| `paste-guard` | Riah Paste Guard |
| `zoom-baseline` | Riah Zoom Baseline |
| `library-search` | Riah Library Search |
| `tab-sleeper` | Riah Tab Sleeper |
| `tenhou-english` | Riah Tenhou English |
| `page-translator` | Riah Page Translator |
| `selection-translator` | Riah Selection Translator |
| `timeline-exporter` | Riah Timeline Exporter |
| `volume-boost` | Riah Volume Boost |
| `youtube-quality` | Riah YouTube Quality |
| `youtube-controls` | Riah YouTube Controls |
| `site-zoom` | Riah Site Zoom |

## First Public Slice

Start with the extensions that are useful, easy to explain, and already have
focused tests around risky behavior:

1. Riah YouTube Controls
2. Riah YouTube Quality
3. Riah Volume Boost
4. Riah Site Zoom

Then add smaller utility releases in batches after the first store review path
is proven.

## Public Export Rule

Use `npm run export:public` before creating a public GitHub repository. The
generated `public-export/riah-extensions/` tree excludes local-only workflow,
migration, and agent notes.
