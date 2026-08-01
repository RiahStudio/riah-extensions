# shared/settings

Shared settings module for Riah Extensions. Facade over
`chrome.storage.sync` / `browser.storage.sync` with schema validation
and version-aware migrations.

**To migrate an extension onto this module, read
[MIGRATION.md](./MIGRATION.md).**

## Quick reference

```js
const settings = RiahSettings.createSettings();

// Read everything (schema defaults applied to missing fields)
const all = await settings.getSettings();

// Patch (validated against the schema, throws on type mismatch)
await settings.setSettings({ disabledHosts: ["bank.example"] });

// Subscribe (returns an unsubscribe function)
const unsub = settings.onChange((changes) => {
  console.log("changed:", changes);
});

// Stamp the schema version (idempotent — safe to call on every launch)
await settings.migrate();
```

## File layout

| File | What it does |
|---|---|
| `index.js` | Public facade: `createSettings()` + default-instance shortcuts. |
| `schema.js` | Field definitions, validators, defaults helper. |
| `migrate.js` | Pure-function migration runner + version stamping. |
| `adapter-chrome.js` | `chrome.storage.sync` wrapper, callback→Promise. |
| `adapter-firefox.js` | `browser.storage.sync` wrapper (native Promise). |
| `adapter-memory.js` | In-memory fixture for tests; isolated per call. |
| `__tests__/` | Node test-runner suite (42 tests, no third-party deps). |
| `MIGRATION.md` | Per-extension migration recipe. |

## Universal-module pattern

Every file is written to load cleanly in three environments:

1. **Browser** (popup.html / options.html via `<script src="...">`):
   attaches to `globalThis.RiahSettings.<modulename>`.
2. **Node** (unit tests via `node --test`): exports via `module.exports`
   and reads dependencies via `require`.
3. **Service worker** (Chrome MV3 / Firefox MV3): same as browser when
   loaded via classic scripts.

The pattern at the bottom of each file:

```js
if (typeof module === "object" && typeof module.exports === "object") {
  module.exports = moduleExports;
} else {
  global.RiahSettings = global.RiahSettings || {};
  global.RiahSettings.<modname> = moduleExports;
}
```

## Tests

```bash
node --test shared/settings/__tests__/*.test.js
```

The memory adapter is the unit-test fixture. The chrome/firefox adapters
are integration-tested by loading the built extension.

## Design choices

- **Hand-rolled validation, no zod.** The project is zero-dependency by
  policy. The five built-in type validators cover every settings shape
  the current extensions need; custom validators are a single function
  on the field.
- **Bare field keys, not `<ext>.<field>`.** Each extension has its own
  `chrome.storage.sync` sandbox, so `disabledHosts` in extension A and
  `disabledHosts` in extension B never collide. Migration wraps existing
  storage instead of relocating it. See MIGRATION.md §4.
- **Facade + Registry/Catalog.** Per the project's PROJECT-SPECIFIC
  NOTES in `SYSTEM DESIGN GUIDE.md`. Adapters are registered by name and
  resolved at construction time; extension code only talks to the
  facade.
