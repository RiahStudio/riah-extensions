# Spec: autoplay-guard

General-purpose media autoplay blocker outside YouTube.

## What it does

On every page, intercept `<video>` and `<audio>` elements and pause them if they try to autoplay. Respect user-initiated play — only block autoplay at the "site tried to play without my click" level.

## Target folder

`shared/autoplay-guard/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — runs at `document_start`
- `popup.html`, `popup.js` — per-site allow toggle
- `background.js` — per-site settings
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>`, `all_frames: true`, `run_at: document_start`
- `storage` — per-site allow-list

## Implementation

Use `Element.prototype.play` interception **before** the site's JS runs (`document_start`):

```js
// content.js — injected at document_start into main world via a script tag
const code = `
  (() => {
    const allowed = ${JSON.stringify(window.__AUTOPLAY_ALLOW__ === true)};
    if (allowed) return;
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function() {
      // Heuristic: if there's been no user gesture recently, refuse.
      if (!navigator.userActivation || !navigator.userActivation.isActive) {
        return Promise.reject(new DOMException("Autoplay blocked by Riah extension", "NotAllowedError"));
      }
      return origPlay.apply(this, arguments);
    };
  })();
`;
const s = document.createElement("script");
s.textContent = code;
(document.head || document.documentElement).prepend(s);
s.remove();
```

The `navigator.userActivation` API tells us whether the user recently interacted. If not, we block `.play()`.

For sites that use `autoplay` attribute directly, also scan DOM on `DOMContentLoaded` and strip the attribute.

## Per-site allow

Popup: "Allow autoplay on this site: ON/OFF". When ON, inject `window.__AUTOPLAY_ALLOW__ = true` before the interception code runs.

## Acceptance criteria

- YouTube home page: video thumbnails don't auto-preview.
- CNN, random news sites: embedded videos don't auto-play.
- Click a play button: video plays normally.
- Allow a site → that site behaves as before.

## Note on overlap with youtube-controls

This one runs everywhere and is general. `youtube-controls` specifically controls YouTube's "after-video-ends, play next" behavior. Different features; both can be installed.
