# Spec: tab-anchor

Moves accidentally detached tabs back into their original window.

## What it does

Listens to `chrome.tabs.onDetached`. When it fires, the tab is in a new window. Move it back into the window it came from, at the index it came from.

## Target folder

`shared/tab-anchor/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `background.js` — service worker / background script
- `icons/`

No popup needed.

## Permissions

- `tabs` — need to move tabs between windows

## Implementation

```js
// background.js
const DETACHED = new Map(); // tabId -> { oldWindowId, oldPosition }

chrome.tabs.onDetached.addListener((tabId, info) => {
  DETACHED.set(tabId, { oldWindowId: info.oldWindowId, oldPosition: info.oldPosition });
});

chrome.tabs.onAttached.addListener(async (tabId, info) => {
  const rec = DETACHED.get(tabId);
  if (!rec) return;
  DETACHED.delete(tabId);

  // Verify the old window still exists, then move the tab back.
  try {
    await chrome.windows.get(rec.oldWindowId);
    await chrome.tabs.move(tabId, { windowId: rec.oldWindowId, index: rec.oldPosition });
    // Close the now-empty new window if we created one by dragging.
    const leftover = await chrome.tabs.query({ windowId: info.newWindowId });
    if (leftover.length === 0) {
      await chrome.windows.remove(info.newWindowId);
    }
  } catch (e) {
    // old window closed — leave the tab where it is
  }
});
```

## Caveat

This is annoying if the user legitimately wanted to detach a tab. Consider a quick "Press Esc to keep tab detached" toast, or a modifier-key bypass (hold Shift while dragging = allow detach). Ship v1 without that and add it if requested.

## Acceptance criteria

- Drag a tab out of the window → tab snaps back within 200ms.
- Works across multiple windows (doesn't refuse to move tabs between pre-existing windows — only fights *new* detach-created windows).
