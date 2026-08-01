# Spec: tenhou-english

Translates the Tenhou HTML5 mahjong client UI strings from Japanese to English.

## What it does

On `tenhou.net/4/` (the HTML5 client), replace Japanese UI text with English equivalents. Game-critical strings (tile names, yaku names, scoring) as a minimum set.

## Target folder

`shared/tenhou-english/`

## Files

- `manifest.chrome.json`, `manifest.firefox.json`
- `content.js`
- `translations.js` — `const TRANSLATIONS = { "対戦": "Match", "段位戦": "Ranked", ... }`
- `icons/`

## Permissions

- `content_scripts.matches`: `https://tenhou.net/4/*`
- `run_at: document_end`, `all_frames: true`

## Implementation

Walk text nodes, replace each matched Japanese string with the English equivalent. Use a MutationObserver for dynamically-rendered UI (game state changes).

```js
function translate(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    let text = node.nodeValue;
    for (const [jp, en] of Object.entries(TRANSLATIONS)) {
      if (text.includes(jp)) text = text.replaceAll(jp, en);
    }
    if (text !== node.nodeValue) node.nodeValue = text;
  }
}

translate(document.body);
new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const n of m.addedNodes) if (n.nodeType === 1) translate(n);
  }
}).observe(document.body, { subtree: true, childList: true });
```

## Translations to ship

The seed translation table should cover common Tenhou UI strings and stay easy to audit and extend. A starting set:
- 対戦 → Match, 段位戦 → Ranked, 友人戦 → Friend Match, ロビー → Lobby
- 東 → East, 南 → South, 西 → West, 北 → North
- 立直 → Riichi, 和了 → Agari, 流局 → Draw
- Yaku list (tanyao, pinfu, iipeikou, etc. — look up standard mappings)

## Acceptance criteria

- tenhou.net/4/ renders with English UI strings visible.
- No network requests made (translations are local).
- Adding a new key+value in `translations.js` picks it up after reload.
