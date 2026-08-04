# Spec: youtube-controls

Persists the preferred YouTube autoplay, caption, and opening-playback state on watch pages and Shorts.

## What it does

Every time a YouTube watch page loads, ensure the autoplay toggle matches the saved preference, turn captions off when that independent preference is enabled, and hold the video paused on its opening frame when that independent preference is enabled.

Shorts get the same open-paused hold. Autonav and captions controls stay watch-page only.

## Target folder

`Riah Extensions from Codex/shared/youtube-controls/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` - runs on YouTube pages at `document_start`
- `popup.html`, `popup.js` - independent autoplay, captions-off, and open-paused preference toggles
- `icons/`

## Permissions

- `content_scripts.matches`: `https://www.youtube.com/*`, `https://m.youtube.com/*`
- `storage` - remembers the setting
- No host permissions beyond the YouTube content-script matches.

## Implementation

On navigation to a `/watch` URL:

1. Wait for the player controls to mount.
2. Read the desired autoplay state (default: off) and captions-off preference (default: on) from storage.
3. Find YouTube's autoplay button.
4. Click only when its current state differs from the saved preference.
5. Find captions only through `.html5-video-player button.ytp-subtitles-button.ytp-button`.
6. Click that exact button only when `aria-pressed="true"`; never use keyboard-shortcut, text, or generic ARIA fallbacks.
7. Never restyle controls or change pointer events.
8. Handle YouTube SPA navigation and late player-control insertion with bounded watch-page retries, without a page-wide mutation observer.
9. Hold the opening frame paused through capture-phase `play` and `playing` listeners on `/watch` and `/shorts/*`, and only while every guard holds: the preference is on, the page is a hold page, the media sits inside the player, the video is under two seconds in, the page armed under twenty seconds ago, and no trusted pointer or key event has reached the player since arming.

## Open-paused guards

The 0.1.0 autoplay stopper paused on every media insert, so YouTube also paused on fullscreen, resize, and player relayout. The hold therefore re-arms only on `yt-navigate-finish` (and Shorts `yt-page-data-updated`), and never pauses a video that is already playing past its opening seconds.

Shorts often re-fire `play` after one pause. The hold keeps pausing while the guards still apply; a real user press sticks because pointer/key input marks the player touched before the next play attempt.

## Acceptance criteria

- Load a YouTube watch page with autoplay on: Riah turns it off by default.
- Toggle autoplay on from the popup: autoplay stays on across pages.
- When YouTube inserts the autoplay control late, Riah still applies the preference.
- With captions on and Keep captions off enabled, Riah clicks the exact CC button once.
- With Keep captions off disabled, Riah does not click the CC button.
- A pointer click on the seek bar still seeks after caption enforcement, even when the seek bar advertises the `c` keyboard shortcut.
- Opening a watch page with Open videos paused enabled: the video holds on its opening frame and pressing play then sticks.
- Opening a Short with Open videos paused enabled: the Short holds paused even if YouTube re-fires play, until the user touches it.
- A video already past its opening seconds is never paused, so fullscreen, resize, and relayout leave playback alone.
- With Open videos paused disabled, Riah never pauses anything.
- Every unrelated YouTube control remains untouched.
