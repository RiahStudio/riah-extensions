# Testing

Run the full automated suite from the repository root:

```powershell
npm test
```

The suite performs:

- Static manifest and source audits.
- Background and shared-library unit tests.
- Browser smoke tests through Microsoft Edge when Edge is installed at the
  expected Windows path.

## Manual Smoke Tests

Build first:

```powershell
npm run build
```

Load Chromium packages from `dist/chrome/<slug>/` and Firefox packages from
`dist/firefox/<slug>/manifest.json`.

| Extension | Smoke test |
| --- | --- |
| `autoplay-guard` | Open a news site with autoplaying media. Media should not start until user interaction. |
| `cookie-quiet` | Open a site with a common cookie banner. The banner should dismiss or reject without accepting by default. |
| `library-search` | Configure a search URL template, open a supported book page, and verify the library search button opens the expected query. |
| `page-translator` | Open a non-English page, click the extension action, and verify a translation view opens. |
| `paste-guard` | Open a page that blocks paste in a field. Paste should work. |
| `right-click-restorer` | Open a page that blocks right-click or text selection. Context menu and selection should work. |
| `selection-translator` | Select text, use the context-menu action, and verify a translation page opens. |
| `site-zoom` | Change zoom on one site, revisit it, and verify the saved zoom reapplies without affecting unrelated sites. |
| `tab-anchor` | Drag a tab out of a window. It should move back to the original window. |
| `tab-sleeper` | Leave an inactive, safe tab idle past the threshold. It should discard without touching active, pinned, audible, or form-heavy tabs. |
| `tenhou-english` | Open Tenhou and verify common UI labels appear in English. |
| `thai-year-helper` | Open a supported Google results page with Buddhist Era years and verify Gregorian context appears. |
| `timeline-exporter` | Open an X/Twitter timeline, start export, and verify a local CSV download is created. |
| `volume-boost` | In Brave/Chromium, play a quiet tab, move the slider above 100%, verify audio increases, then reset to 100%. |
| `youtube-controls` | Open a YouTube watch page and verify autoplay/caption preferences apply without seek-bar interference. |
| `youtube-quality` | Open a YouTube watch page and verify the configured quality ceiling is applied. |
| `zoom-baseline` | Open a few tabs and verify the default zoom baseline is applied. |

## Public Release Gates

```powershell
npm test
npm run package:public
Start All Riah Extensions in Brave.bat --check
npm run export:public
```

Review `release/SHA256SUMS.txt`, generated ZIP contents, and
`public-export/riah-extensions/` before uploading or publishing.
