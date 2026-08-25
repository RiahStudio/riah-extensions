# Spec: youtube-controls

Persists the preferred YouTube autoplay, caption, and opening-playback state on watch pages and Shorts.

## What it does

Every time a YouTube watch page loads, ensure the autoplay toggle matches the saved preference, turn captions off when that independent preference is enabled, and hold the video paused on its opening frame when that independent preference is enabled.

Shorts get the same open-paused hold. Autonav and captions controls stay watch-page only. Playlist, mix, and album queues keep YouTube's own next-item behavior: do not hold them paused and do not force the autoplay toggle off. Treat a queue as a playlist when the watch URL has `list=`, when YouTube's playlist panel is visible, or when the player reports a playlist id. If `list=` lags one frame on SPA advance, do not re-arm the hold until that settles.

## Target folder

`extension-source/shared/youtube-controls/`

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
9. Hold the opening frame paused through capture-phase `play` and `playing` listeners on `/watch` and `/shorts/*`, and only while every guard holds: the preference is on, the page is a hold page, the page is not a playlist/mix/album queue, the media sits inside the player, the video is under two seconds in, the page armed under twenty seconds ago, no queue-advance grace window is open, and no trusted pointer or key event has reached the player since arming.
10. If the page is a playlist, mix, or album queue, skip the autoplay-toggle preference and skip re-arming the open-paused hold on `yt-navigate-finish`. Captions still follow the saved preference. If `list=` is missing for a moment after a queue advance, wait briefly before arming so the next item is not paused.
11. If the document is hidden, or this tab has already been playing, treat it as a listening session: skip the hold and skip forcing autoplay off, so a background music playlist cannot go silent and then get discarded. Once a session is listening, do not re-arm the open-paused hold.

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
- A playlist, mix, or album queue is never held paused, and its autoplay toggle is left alone so the next item can play.
- A playlist advance whose `list=` parameter lands a moment late is still not paused.
- Every unrelated YouTube control remains untouched.
