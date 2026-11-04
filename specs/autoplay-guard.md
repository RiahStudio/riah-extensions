# Spec: autoplay-guard

General-purpose media autoplay blocker outside dedicated music sites.

## What it does

Outside dedicated music players, intercept new `<video>` and `<audio>` play attempts that lack user activation. Never call `pause()` on media that is already playing. After the user has started playback on a page, later `play()` calls on that page are allowed so queues can advance. YouTube, SoundCloud, Spotify, Apple Music, Bandcamp, Mixcloud, and other dedicated music/podcast/radio hosts are a built-in bypass so the next track can play, including from widget frames that never received the original click (especially in Firefox). YouTube's after-video autoplay toggle stays with the dedicated Riah YouTube extension.

WhatsApp Web is a built-in bypass. The extension must not wrap `HTMLMediaElement.play` or inject MAIN-world scripts there — WhatsApp treats that as tampering and stays on the splash.

Stay off the shared quiet-host list (WhatsApp, Discord, Slack, Gmail/Docs, Figma, Notion, GitHub, and similar). Those pages break if `HTMLMediaElement.play` is wrapped. Load `quiet-hosts/index.js` before the other content scripts.

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

At `document_start`, exit immediately on dedicated music hosts (YouTube, SoundCloud, Spotify, Apple Music, Amazon Music, Bandcamp, Mixcloud, Tidal, Deezer, podcast/radio players, and their player/CDN subdomains). Do not bypass general sites that also happen to have a player (Amazon retail, Apple.com, BBC News). Elsewhere, wrap `HTMLMediaElement.prototype.play` in the main world. Reject a new play attempt only when the site is not allow-listed and the user has not interacted with the page. A click, tap, or key press on the page unlocks later `play()` calls so a video can start once it has finished loading — do not require the play call itself to happen in the same instant as the click.

For sites that use `autoplay` attributes directly, scan the DOM and strip only those attributes until the user interacts. After that interaction, stop rewriting the player so loading is not delayed. DOM insertion, fullscreen, resize, and layout changes must never pause existing media.

## Per-site allow

Popup: "Allow autoplay on this site: ON/OFF". When enabled, the original play behavior is allowed. Use this for a music site that is not yet on the built-in list.

## Acceptance criteria

- YouTube and its subdomains: install no wrapper or observer and never affect playback.
- Dedicated music, podcast, and radio hosts (including widget frames such as `w.soundcloud.com` and `open.spotify.com`): install no wrapper or observer and never affect playback.
- News and other sites: initial script-driven autoplay without user activation is rejected.
- Clicking a play button allows normal playback, including when the player calls `play()` only after the video has loaded.
- After that click, the next item in a music or podcast queue on the same page can play without another gesture.
- Moving an already-playing video in the DOM, resizing a player, entering fullscreen, or attaching debugging never calls `pause()`.
- Allow-listing a site restores its original autoplay behavior.

## Note on overlap with youtube-controls

This extension explicitly bypasses YouTube. `youtube-controls` exclusively controls YouTube's after-video autoplay toggle and captions preference.
