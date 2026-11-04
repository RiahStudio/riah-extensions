# Spec: english-search

Keeps search, shopping, and video lookup in English. Stops Google from bouncing a Thailand IP onto Thai results.

## What it does

- Sends `Accept-Language: en-US,en;q=0.9` so sites stop guessing Thai.
- Rewrites `google.co.th` to `google.com`.
- Forces English on Google, YouTube **search**, Bing, DuckDuckGo, Brave Search, Amazon, Play Store, and the Chrome Web Store (`hl=en`, `gl=us` / `gl=US`, `lr=lang_en` where it applies).
- YouTube watch / playlist / Music player URLs are left alone so the next song is not reloaded.
- Leaves Gmail, Docs, Drive, Calendar, Meet, Classroom, Admin, Chat, and account pages alone. The content script installs nothing on those hosts — no `history.pushState` / `replaceState` patch.

## Target folder

`shared/english-search/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `rewrite.js` — pure URL rewrite (tested)
- `rules.json` — declarativeNetRequest header + redirect rules
- `background.js` — navigation fallback
- `content.js` — catches in-page search changes (YouTube SPA, Google)
- `icons/`

## Permissions

- `declarativeNetRequest` — change language headers and search URLs
- `webNavigation` — catch Thai Google redirects the rules miss
- `host_permissions` only for Google / YouTube / Bing / DuckDuckGo / Brave Search / Amazon / Chrome Web Store
- No `<all_urls>`, no cookies, no storage, no popup

## Acceptance criteria

- A Google search for a store from Thailand lands on `google.com` with English results, not `google.co.th`.
- YouTube, Bing, and DuckDuckGo searches pick English.
- Gmail / Docs / Accounts URLs are unchanged, and the content script's early-return path runs before any history patch.
- `npm test` stays green.
