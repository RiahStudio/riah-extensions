# Spec: youtube-controls

Persists the preferred YouTube autoplay and caption state on watch pages.

## What it does

Every time a YouTube watch page loads, ensure the autoplay toggle is OFF (or whatever the user set).

## Target folder

`shared/youtube-controls/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — runs on youtube.com watch pages
- `popup.html`, `popup.js` — toggle "Autoplay: Off / On"
- `icons/`

## Permissions

- `content_scripts.matches`: `https://www.youtube.com/*`, `https://m.youtube.com/*`
- `storage` — remember setting
- No host permissions beyond what content_scripts imply.

## Implementation

YouTube's autoplay toggle is a button with `aria-label="Autoplay is on"` or `"Autoplay is off"` inside the player controls. On navigation to a `/watch` URL:

1. Wait for `ytd-watch-flexy` + player chrome to mount.
2. Read desired state from storage (default: off).
3. Find the autoplay button. If current state doesn't match desired, click it.
4. Observe `yt-navigate-finish` events (YouTube's internal navigation) to re-apply on every page change.

## Acceptance criteria

- Load any YouTube watch page → autoplay is off.
- Click extension icon, toggle to on → autoplay stays on across pages.
- Video end: next video does/doesn't autoplay per setting.
