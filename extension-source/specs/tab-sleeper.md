# Spec: tab-sleeper

Discards idle tabs to free memory while keeping them in the tab bar.

## What it does

- After N minutes of tab inactivity, call `chrome.tabs.discard(tabId)` on it.
- Never discard: pinned tabs, tabs playing audio, tabs with unsaved form input, the currently-focused tab, hosts on the allow-list.
- Let the user manually discard a tab from the popup.

## Target folder

`shared/tab-sleeper/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `background.js` 窶・service worker. Tracks last-activity per tab, runs a periodic sweep via `chrome.alarms`.
- `popup.html`, `popup.js`, `popup.css` 窶・"Discard this tab now", shows time-since-active, quick toggle to exclude current host.
- `options.html`, `options.js` 窶・inactivity threshold (default 5 min), allow-list textarea.
- `icons/`

## Permissions

- `tabs` 窶・need tab metadata beyond `activeTab`
- `alarms` 窶・periodic sweep
- `storage` 窶・settings
- **No** `host_permissions`. `tabs.discard` does not need any.

## Key logic

```js
// background.js sketch 窶・service worker
const ACTIVITY = new Map(); // tabId -> timestamp

chrome.tabs.onActivated.addListener(({ tabId }) => ACTIVITY.set(tabId, Date.now()));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.audible !== undefined) ACTIVITY.set(tabId, Date.now());
});
chrome.tabs.onRemoved.addListener((tabId) => ACTIVITY.delete(tabId));

chrome.alarms.create("sweep", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "sweep") return;
  const { thresholdMin = 5, excludeHosts = [] } = await chrome.storage.sync.get(["thresholdMin", "excludeHosts"]);
  const cutoff = Date.now() - thresholdMin * 60 * 1000;
  const tabs = await chrome.tabs.query({ discarded: false });
  for (const tab of tabs) {
    if (tab.active || tab.pinned || tab.audible) continue;
    if (excludeHosts.some((h) => new URL(tab.url || "about:blank").hostname.endsWith(h))) continue;
    const last = ACTIVITY.get(tab.id) ?? 0;
    if (last < cutoff) chrome.tabs.discard(tab.id).catch(() => {});
  }
});
```

## Firefox note

`tabs.discard` exists in Firefox. Same signature. Service worker in Chrome vs background scripts in Firefox 窶・handled at the manifest layer.

## Popup UI

- Shows current tab's host + "idle Xm Ys" (or "active")
- Button: "Discard this tab"
- Toggle: "Never discard this host" (adds to allow-list)

## Acceptance criteria

- Leave a tab untouched for 5 minutes 竊・it enters discarded state (grayed tab in Firefox, or "Not loaded" indicator).
- Play audio in a tab 竊・it never gets discarded regardless of age.
- Add `example.com` to allow-list 竊・tab stays loaded forever.
