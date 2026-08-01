# Spec: autoplay-guard

General-purpose media autoplay blocker outside YouTube.

## What it does

Outside YouTube, intercept new `<video>` and `<audio>` play attempts that lack user activation. Never call `pause()` on media that is already playing. YouTube is a built-in bypass because its dedicated Riah autoplay extension controls the after-video autoplay toggle without interfering with playback.

## Target folder

`extension-source/shared/autoplay-guard/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` - runs at `document_start`
- `main-world.js` - installs the guarded `HTMLMediaElement.play` wrapper
- `popup.html`, `popup.js` - per-site allow toggle
- `background.js` - per-site settings
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>`, `all_frames: true`, `run_at: document_start`
- `storage` - per-site allow-list
- `activeTab` - current-site popup control

## Implementation

At `document_start`, exit immediately on `youtube.com` and its subdomains. Elsewhere, wrap `HTMLMediaElement.prototype.play` in the main world. Reject a new play attempt only when the site is not allow-listed and there is no active user gesture.

For sites that use `autoplay` attributes directly, scan the DOM and strip only those attributes. DOM insertion, fullscreen, resize, and layout changes must never pause existing media.

## Per-site allow

Popup: "Allow autoplay on this site: ON/OFF". When enabled, the original play behavior is allowed.

## Acceptance criteria

- YouTube and its subdomains: install no wrapper or observer and never affect playback.
- News and other sites: initial script-driven autoplay without user activation is rejected.
- Clicking a play button allows normal playback.
- Moving an already-playing video in the DOM, resizing a player, entering fullscreen, or attaching debugging never calls `pause()`.
- Allow-listing a site restores its original autoplay behavior.

## Note on overlap with youtube-controls

This extension explicitly bypasses YouTube. `youtube-controls` exclusively controls YouTube's after-video autoplay toggle and captions preference.
