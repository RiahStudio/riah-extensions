# Spec: thai-year-helper

Adds Gregorian year context beside Thai Buddhist Era years on supported pages.

## What it does

Finds four-digit years in range 2400–2700 BE in page text, appends the Gregorian equivalent in parentheses. E.g. "ปี 2568" → "ปี 2568 (2025)".

## Target folder

`shared/thai-year-helper/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js`
- `popup.html`, `popup.js` — toggle on/off per site, toggle inline/replace modes
- `icons/`

## Permissions

- `content_scripts.matches`: `<all_urls>` (or, to be tight, `https://www.google.com/*`, `https://*.google.co.th/*`) — user preference. **Default to Google only** per the original extension's purpose.
- `storage`

## Implementation

```js
// content.js
const BE_YEAR = /\b(2[4-7]\d{2})\b/g;

function annotate(node) {
  if (node.nodeType !== Node.TEXT_NODE) return;
  const parent = node.parentElement;
  if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return;
  if (!BE_YEAR.test(node.nodeValue)) { BE_YEAR.lastIndex = 0; return; }
  BE_YEAR.lastIndex = 0;
  node.nodeValue = node.nodeValue.replace(BE_YEAR, (m) => `${m} (${parseInt(m, 10) - 543})`);
}

function walk(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const batch = [];
  let n;
  while ((n = walker.nextNode())) batch.push(n);
  batch.forEach(annotate);
}

walk(document.body);
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) walk(n);
}).observe(document.body, { subtree: true, childList: true });
```

## Popup

- Toggle: "Enable on this site: ON/OFF"
- Mode: "Annotate `(2025)`" (default) / "Replace with Gregorian"

## Acceptance criteria

- Google search in Thai locale returns results with "2568" → page shows "2568 (2025)" everywhere that number appears in text.
- Toggle off → page reverts on reload.
- Extension doesn't rewrite already-annotated text on repeat passes.
