# Spec: timeline-exporter

Exports visible posts from an X/Twitter profile or thread to a local CSV file.

## What it does

Click the extension icon on an X profile page or thread → extension scrolls the timeline, collects tweet text, author, timestamp, URL, engagement counts → downloads a CSV.

## Target folder

`shared/timeline-exporter/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js` — scrolls, reads DOM, yields tweet records
- `popup.html`, `popup.js`, `popup.css` — start/stop button, counter, "Download CSV"
- `background.js` — relay messages between popup and content script
- `icons/`

## Permissions

- `content_scripts.matches`: `https://x.com/*`, `https://twitter.com/*`, `https://*.x.com/*`
- `scripting` — for `chrome.scripting.executeScript` to inject on-demand
- `storage` — remember last export settings
- **No** `host_permissions`. Everything is scoped to x.com via `content_scripts.matches`.

## Scraping approach

Tweets on X are rendered as articles with `data-testid="tweet"`. Read:
- `article [data-testid="tweetText"]` for text
- `article a[href*="/status/"]` for permalink + tweet ID
- `article time` for timestamp (ISO in `datetime` attr)
- `article [data-testid="User-Name"]` for author handle
- `article [data-testid="reply"]`, `like`, `retweet` for counts (spans with aria-label)

Virtualization is the hard part: X unmounts tweets when they scroll out of view. So the extension must:
1. Scroll down one viewport at a time.
2. Before unmount, record every visible tweet into a `Map` keyed by tweet ID (dedupes).
3. Stop when no new tweets appear after N scrolls.
4. Emit CSV.

## CSV format

```
id,author_handle,timestamp,text,url,replies,retweets,likes,views
```

Text gets quoted with CSV escaping (double quotes doubled, commas + newlines preserved inside quotes).

## Popup UI

- Status: "Idle" / "Scrolling… 147 tweets so far"
- Buttons: "Start export", "Stop", "Download CSV"
- Checkbox: "Include replies" (default off on profile pages)

## Acceptance criteria

- Works on `x.com/<user>` (timeline) and `x.com/<user>/status/<id>` (thread).
- Exports at least 200 tweets from a scroll session without duplicates.
- CSV opens cleanly in Excel/Numbers.
- No data leaves the browser. No remote endpoint is contacted.

## Risk note

X actively breaks scrapers. Expect selectors to need updating. That's why we own the code — easy to patch.
