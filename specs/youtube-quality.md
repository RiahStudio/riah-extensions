# Spec: youtube-quality

Sets YouTube video quality to the highest available level or a preferred ceiling.

## What it does

On a YouTube `/watch` page, once the player is ready, programmatically set the quality via the player API.

## Target folder

`shared/youtube-quality/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js`
- `popup.html`, `popup.js` — quality selector: Auto-max, 1080p60, 1440p60, 2160p60, 720p, etc.
- `icons/`

## Permissions

- `content_scripts.matches`: `https://www.youtube.com/*`, `https://m.youtube.com/*`
- `storage`

## Implementation

YouTube's player exposes `setPlaybackQualityRange(hd1080, hd1080, {label: "1080p60"})` internally. It's not in a public API but it's accessible on the player element:

```js
// content.js — injected into main world via script tag
const preferredLabels = ["hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small"];

function setMax() {
  const player = document.querySelector("#movie_player");
  if (!player) return false;
  const available = player.getAvailableQualityLabels?.() || [];
  const levels = player.getAvailableQualityLevels?.() || [];
  // levels are like ["hd2160", "hd1440", ...] highest first.
  const target = levels[0];
  if (target) {
    player.setPlaybackQualityRange(target, target);
    return true;
  }
  return false;
}

// Retry until player is ready.
const interval = setInterval(() => { if (setMax()) clearInterval(interval); }, 500);

// Re-run on navigation.
document.addEventListener("yt-navigate-finish", () => {
  setTimeout(setMax, 500);
});
```

This needs to run in the page's main world (not isolated content-script world) to access the player object. Use a script tag injection from `content.js`.

## Popup

- "Preferred max quality" select: Auto-max (highest available) / 2160p / 1440p / 1080p / 720p / 480p
- Saves to `chrome.storage.sync`.

## Acceptance criteria

- Open a 4K video → plays at 4K without manual change.
- Set preferred max to 1080p → 4K videos play at 1080p, 720p videos stay at 720p.
- Works after in-page navigation (clicking next video).
