# Migrating to the shared settings module

This module wraps `chrome.storage.sync` / `browser.storage.sync` behind one
uniform Promise-returning API, plus a tiny schema/validation layer and a
version-aware migration runner. The goal is to stop hand-rolling the same
callback-to-Promise wrappers in every popup, options page, and background
script across the Riah extensions.

This file is the migration guide. The proof-of-integration touchpoint —
`shared/right-click-restorer/popup.js` — is already moved over. The rest of
the touchpoints stay on their legacy `chrome.storage.sync.get/set(...)`
calls until each gets its own migration commit.

## Architecture in one diagram

```
┌────────────────────────────────────────────────────────────┐
│  Extension code (popup.js, background.js, options.js, ...) │
└──────────────────────────┬─────────────────────────────────┘
                           │ RiahSettings.createSettings()
                           ▼
┌────────────────────────────────────────────────────────────┐
│  index.js   ← facade: getSettings / setSettings / onChange │
│              + getSchema + migrate                         │
└─────────┬────────────────┬───────────────────┬─────────────┘
          │                │                   │
          ▼                ▼                   ▼
   schema.js        migrate.js          adapter-*.js
   (validation +    (version-aware      (chrome / firefox /
   defaults)        migration runner)    memory — registered
                                         by browser at runtime)
```

- **Facade** — extension code only knows the four public methods. Adapter
  selection, callback-to-Promise conversion, and validation all happen
  inside.
- **Registry/Catalog** — the three adapters live in
  `RiahSettings.adapters.{chrome, firefox, memory}`. `detectAdapter()`
  picks the right one at runtime; tests pass `memory` explicitly.

## How the build wires it up

`build.js` was extended to detect "shared library" folders — any directory
under `shared/` that doesn't have a `manifest.chrome.json` or
`manifest.firefox.json`. For each extension being built, it greps the
source for references to each library folder name (`settings/foo.js`,
`./settings`, etc.). If found, the library is copied into
`dist/<browser>/<ext>/<lib>/`.

That means: to use the shared settings module from a new extension, you
**just reference it** from your source (HTML script tag or JS require/
import). The build picks it up automatically — no `_deps.json`, no manifest
of dependencies to maintain.

## Migrating an existing touchpoint

For an extension whose popup/options/background currently uses
`chrome.storage.sync.get(...)` directly:

### 1. Wire the scripts into the HTML

If the touchpoint is a popup or options page, add this block in the HTML
*before* your existing script tag:

```html
<script src="settings/schema.js"></script>
<script src="settings/migrate.js"></script>
<script src="settings/adapter-chrome.js"></script>
<script src="settings/adapter-firefox.js"></script>
<script src="settings/adapter-memory.js"></script>
<script src="settings/index.js"></script>
<script src="popup.js"></script>  <!-- existing -->
```

Load order matters: `schema` and `migrate` are dependencies of `index`;
all three adapters must be loaded before `index` so the registry knows
about them.

For a background service worker (Chrome MV3), the load story is different
— MV3 background scripts run as ES modules under `"type": "module"` or as
classic scripts. The simplest path: import via `importScripts` from a
classic background script, or wrap the settings files in a single
concatenated bundle. **Defer background-script migration to a follow-up
commit per extension** — it's a per-extension decision, not a library
one. The popup/options path above works without any manifest changes.

### 2. Drop the hand-rolled wrappers

Replace inline helpers like:

```js
function storageGet(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, (value) => {
      const error = chrome.runtime.lastError;
      if (error) { reject(new Error(error.message)); return; }
      resolve(value);
    });
  });
}
```

…with the facade call. Build it once at module top:

```js
const settings = RiahSettings.createSettings();
```

Then read/write through it:

```js
const all = await settings.getSettings();        // returns full settings + defaults
await settings.setSettings({ myField: newValue });
const unsub = settings.onChange((changes) => { /* react */ });
```

### 3. Declare your fields in the schema

Open `shared/settings/schema.js` and add an entry to `DEFAULT_SCHEMA.fields`:

```js
fields: {
  disabledHosts: { ... },          // existing
  myNewField: {
    type: "boolean",
    default: false,
    validate: TYPE_VALIDATORS.boolean,
    description: "What this field controls; which extension owns it.",
  },
},
```

If your field doesn't fit a built-in type, add a validator function:

```js
const isPercent = (v) => typeof v === "number" && v >= 0 && v <= 100;
fields: {
  zoomPercent: {
    type: "percent",
    default: 100,
    validate: isPercent,
  },
},
```

### 4. About namespacing (or, why field keys are bare)

Each extension has its own `chrome.storage.sync` sandbox at runtime, so
`disabledHosts` in extension A and `disabledHosts` in extension B never
collide at the storage layer. Field keys in `DEFAULT_SCHEMA` use the same
bare names the extensions already write to storage, which means migration
**doesn't relocate data** — you wrap what's already there.

If two extensions need conflicting schemas for the same key, the second
one passes its own schema:

```js
const settings = RiahSettings.createSettings({
  schema: {
    version: 1,
    fields: {
      disabledHosts: {
        type: "object",      // different shape than the default
        default: {},
        validate: TYPE_VALIDATORS.object,
      },
    },
  },
});
```

### 5. Add a migration if the data shape changes

When you change a field's type, rename a key, or split one value into
many, bump `SCHEMA_VERSION` in `schema.js` and append a function to
`MIGRATIONS` in `migrate.js`:

```js
const MIGRATIONS = [
  function v0_to_v1(old) { return { ...old }; },              // existing
  function v1_to_v2(old) {                                    // new
    if (typeof old.disabledHosts === "string") {
      // old format was a comma-separated string; turn it into an array
      return { ...old, disabledHosts: old.disabledHosts.split(",") };
    }
    return { ...old };
  },
];
```

Then call `settings.migrate()` once on extension startup (typically the
first thing the service worker does in `chrome.runtime.onInstalled`).
It's idempotent — running it twice doesn't re-run anything — so it's
safe to call on every launch.

## What stays on the legacy path

Touchpoints not yet migrated:

| Extension | File | Notes |
|---|---|---|
| right-click-restorer | `content.js` | Reads `disabledHosts`. Leave alone; content scripts run in MAIN/ISOLATED worlds and need a different load story than popups. |
| right-click-restorer | `background.js` | Stub installer; leave alone. |
| autoplay-guard | `background.js`, `popup.js` | Per-host toggle list. |
| thai-year-helper | `popup.js`, `content.js` | Mode-by-host map. |
| cookie-quiet | `background.js`, `popup.js`, `options.js` | Largest surface — multiple settings; do this one last. |
| library-search | `popup.js`, `options.js`, `content.js` | Search template string. |
| tab-sleeper | `background.js`, `popup.js`, `options.js` | Threshold, excludes, activity timestamps. |
| page-translator | `background.js`, `options.js` | Target language. |
| selection-translator | `background.js`, `options.js` | Target language. |
| timeline-exporter | `background.js`, `content.js`, `popup.js` | Include-replies toggle. |
| youtube-controls | `popup.js`, `content.js` | Autoplay-enabled toggle. |
| youtube-quality | `popup.js`, `content.js` | Preferred quality. |
| site-zoom | `background.js`, `popup.js`, `options.js` | Per-host zoom map. |

Each gets its own migration commit. The pattern is the same every time:

1. Add the field(s) to `DEFAULT_SCHEMA`.
2. Wire `settings/*.js` into the HTML.
3. Replace inline wrappers with `RiahSettings` calls.
4. (Background scripts) decide on a load story for that specific
   extension.
5. Run the existing `tests/run.js` to confirm nothing regressed.

## Testing

Unit tests for the module live in `__tests__/` and run under Node's
built-in test runner:

```bash
node --test shared/settings/__tests__/*.test.js
```

42 tests covering: schema validation, defaults, migrations, the memory
adapter contract, and the facade's read/write/subscribe surface. The
chrome/firefox adapters are integration-tested manually by loading the
built extension.

## Permissions

Every extension that consumes the shared module needs `"storage"` in its
`permissions` array. All currently-built Riah extensions that touch
settings already have it — verify in the extension's `manifest.chrome.json`
and `manifest.firefox.json` before wiring. **No new permissions are
introduced** by adopting the shared module; if your extension didn't need
`storage` before, it doesn't need it now.
