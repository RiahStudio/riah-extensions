# Spec: youtube-resume

Puts you back where you were in a YouTube video after the tab is discarded or reopened.

## Why

Brave's built-in Memory Saver discards an idle tab to free memory. Waking it reloads
`watch?v=...`, and that URL carries no timestamp, so YouTube starts the video over.
Exempting YouTube from Memory Saver would fix the place and cost the memory. This
fixes the place and keeps the memory saving: the tab may be discarded freely,
because the position is written down outside the page.

YouTube's own resume is not a substitute — it needs a signed-in account with watch
history on, and it records the position on its own schedule rather than at the
moment the tab is taken away.

## Target folder

`extension-source/shared/youtube-resume/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — runs on YouTube pages
- `popup.html`, `popup.js` — on/off, come-back-paused, and Forget saved places
- `icons/`

## Permissions

- `content_scripts.matches`: `https://www.youtube.com/*`, `https://m.youtube.com/*`
- `storage` — the saved places and the two preferences
- No host permissions beyond the YouTube content-script matches. Nothing leaves
  the browser; no account, cookie, or watch-history access.

## Implementation

Saving, while a video is on screen:

1. Recognise the video id from `/watch?v=`, `/shorts/<id>`, `/live/<id>`, `/embed/<id>`.
2. Write `{ t, d, paused, at }` to `chrome.storage.local` under `place:<videoId>`
   immediately on `pause`, `seeked`, `visibilitychange` → hidden, `pagehide`, and
   `freeze` — the moments that precede losing the tab — and otherwise at most
   once every fifteen seconds during `timeupdate`, purely as a backstop for a
   browser that dies without firing any of them.
3. Skip the write entirely when nothing has moved: same video, same paused state,
   position within a second of what was last written. A parked tab writes once
   and then stops.
4. Ignore anything under ten seconds in — not worth a note.
5. Delete the note once the video is within fifteen seconds of the end, or on `ended`.

Restoring, on load and on every SPA navigation (`yt-navigate-finish`, `popstate`):

5. Do nothing when the URL already names a time (`t`/`start`/`#t=`) — a chosen
   start always wins.
5b. Do nothing when the watch URL has `list=` (playlist, mix, or album) — an old
    saved place would skip or pause the next item.
5c. Do nothing on in-tab next-item navigation unless the page was just woken from a discard (`document.wasDiscarded`).
6. Do nothing when the video is already past three seconds — something else set it.
7. Wait for the player (bounded poll, ~15s) and for `readyState >= 1`, then seek.
   YouTube resets `currentTime` while its player settles, so the seek is retried
   up to three times and stops as soon as it sticks.
8. Pause once after seeking when the note says it was paused and *Come back
   paused* is on.

Housekeeping:

9. Keep at most 400 places, dropping the oldest by `at`.
10. Each navigation takes a generation number; an async step from the previous
    video can never attach to the new one.

## Known bound

A discard can cost up to four seconds of position — `freeze` fires immediately
before the page is taken away and the storage write may not survive it, so the
periodic save is what actually holds the line. Four seconds is deliberate: a
tighter interval writes to disk more often for a smaller prize.

## Interaction with youtube-controls

`youtube-controls` holds a video on its opening frame when *Open videos paused* is
enabled, guarded on the video being under two seconds in. A restored video is well
past that, so the two never fight: the hold ignores it, and this extension's own
paused-restore is what keeps it still.

## Acceptance criteria

- Watch seven minutes of a video, pause, let Brave discard the tab, click back:
  the video is at seven minutes, not zero.
- Same again while playing: it comes back at the right place.
- Open a link with `&t=90`: it starts at ninety seconds, not at the saved place.
- Open a playlist or mix item that was saved from an earlier watch: it starts at
  the beginning, not at the old place, and is not paused from that old note.
- Seek manually to a different spot, reload: the manual spot is what returns.
- Watch a video to the end, reload: it starts from the beginning, not from 15
  seconds before the end.
- Open a video for five seconds and leave: nothing is saved.
- Turn the extension off in the popup, reload: no seeking happens at all.
- *Forget saved places* empties the count and no video resumes afterwards.
