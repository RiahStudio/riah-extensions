# Spec: library-search

Opens a configured library or catalog search from supported book pages.

## What it does

On Amazon book pages, Goodreads, and similar, adds a button: "Search my library". Click → opens the book's title in the user's configured library search URL.

## Target folder

`shared/library-search/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — detects book title/ISBN on supported sites, injects button
- `options.html`, `options.js` — library search URL template (e.g. `https://libby.com/search?q={title}` or a local OPAC)
- `popup.html`, `popup.js` — shortcut to options, quick search for any query
- `icons/`

## Permissions

- `content_scripts.matches`: `https://www.amazon.*/*`, `https://www.goodreads.com/*`, `https://www.google.com/books/*`
- `storage`

## Detection

On Amazon book pages: title from `#productTitle`, author from `.contributorNameID`, ISBN from `#detailBullets_feature_div` (regex for 10/13-digit ISBN).

On Goodreads: title from `h1.Text__title1`, ISBN from `[data-testid="isbn"]`.

## URL template substitution

Template language: `{title}`, `{author}`, `{isbn}`. User enters e.g.:
```
https://www.worldcat.org/search?q={title}+{author}
```

Extension substitutes, URL-encodes values, opens in new tab.

## Acceptance criteria

- Amazon book page has a "Search my library" button that opens the configured URL with title filled in.
- Options page lets the user edit the template; changes apply immediately.
- If no template is configured, button is not injected.

## Upgrade path

Later, add real OverDrive/Libby API integration (requires user's library card credentials — sensitive, defer).
