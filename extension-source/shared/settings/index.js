/**
 * index.js — public API for the shared settings module.
 *
 * Facade pattern: hides the browser-API differences (chrome.storage.sync vs
 * browser.storage.sync) and the schema/migration plumbing behind one
 * uniform interface. Registry pattern: adapters are registered by name
 * ("chrome", "firefox", "memory") and selected at construction time.
 *
 * Usage in a browser extension:
 *
 *     // popup.js (after loading the settings/*.js scripts in popup.html)
 *     const settings = RiahSettings.createSettings();
 *     const all = await settings.getSettings();
 *     await settings.setSettings({ "absoluteRightClick.disabledHosts": [...] });
 *     const unsub = settings.onChange((changes) => { ... });
 *
 * Usage in Node tests:
 *
 *     const { createSettings } = require("../index");
 *     const { createMemoryAdapter } = require("../adapter-memory");
 *     const settings = createSettings({ adapter: createMemoryAdapter() });
 */
(function (global) {
  "use strict";

  // ---- dependency resolution (Node require / browser globalThis) ----

  function getDep(name) {
    if (
      typeof module === "object" &&
      typeof require === "function" &&
      typeof module.exports === "object"
    ) {
      return require("./" + name);
    }
    const ns = global.RiahSettings || {};
    // Map kebab-ish filenames to global namespace keys.
    const map = {
      schema: ns.schema,
      migrate: ns.migrate,
      "adapter-chrome": ns.adapterChrome,
      "adapter-firefox": ns.adapterFirefox,
      "adapter-memory": ns.adapterMemory,
    };
    if (!(name in map)) {
      throw new Error(`settings/index.js: unknown dep "${name}"`);
    }
    return map[name];
  }

  // ---- adapter selection ----

  /**
   * Pick the right adapter for the current runtime. Order:
   *   1. Native `browser.*` (Firefox) — Promise-native.
   *   2. `chrome.*` (Chromium and Firefox's shim) — wrapped to Promise.
   *   3. Throw — no storage available (Node without an explicit adapter
   *      passed in, or a worker context with no extension APIs).
   *
   * Most extensions will land on the chrome adapter even in Firefox, because
   * Firefox supplies a chrome.* shim. The firefox adapter is for callers
   * that want browser.* explicitly.
   */
  function detectAdapter() {
    const chromeAdapter = getDep("adapter-chrome");
    const firefoxAdapter = getDep("adapter-firefox");
    if (firefoxAdapter.isAvailable()) return firefoxAdapter;
    if (chromeAdapter.isAvailable()) return chromeAdapter;
    throw new Error(
      "No storage adapter available. Pass one explicitly via createSettings({ adapter })."
    );
  }

  // ---- facade ----

  /**
   * Build a settings instance.
   *
   * Options:
   *   - schema:  defaults to DEFAULT_SCHEMA from schema.js.
   *   - adapter: defaults to detectAdapter() (chrome/firefox at runtime).
   *
   * Returns an object exposing:
   *   getSettings()                 → Promise<settings>
   *   setSettings(patch)            → Promise<void>
   *   onChange(listener)            → unsubscribe()
   *   getSchema()                   → schema (frozen reference)
   *   migrate()                     → Promise<{ ranFrom, ranTo }>
   */
  function createSettings(options) {
    const schemaModule = getDep("schema");
    const migrateModule = getDep("migrate");
    const opts = options || {};
    const schema = opts.schema || schemaModule.DEFAULT_SCHEMA;
    const adapter = opts.adapter || detectAdapter();

    async function getSettings() {
      // Pass defaults so the adapter returns a full object even on first run.
      const defaults = schemaModule.defaults(schema);
      const raw = await adapter.get(defaults);
      return schemaModule.withDefaults(raw, schema);
    }

    async function setSettings(patch) {
      const result = schemaModule.validate(patch, schema);
      if (!result.ok) {
        throw new Error(
          `setSettings: invalid patch — ${result.errors.join("; ")}`
        );
      }
      await adapter.set(patch);
    }

    function onChange(listener) {
      // The adapter listener fires with (changes, areaName). Re-shape so
      // callers don't have to know about the storage-area concept.
      return adapter.onChanged((changes /* , areaName */) => {
        listener(changes);
      });
    }

    function getSchema() {
      return schema;
    }

    /**
     * Run migrations from the stored version up to schema.version, then
     * persist the migrated result + the new version stamp. Idempotent: if
     * stored version === schema version, it's a cheap read with no writes.
     *
     * Returns { ranFrom, ranTo, migrated } — useful for logging during
     * service-worker startup.
     */
    async function migrate() {
      const all = await adapter.get(null);
      const fromVersion = migrateModule.readVersion(all);
      const toVersion = schema.version;
      if (fromVersion === toVersion) {
        return { ranFrom: fromVersion, ranTo: toVersion, migrated: false };
      }
      const migrated = migrateModule.runMigrations(
        all,
        fromVersion,
        toVersion
      );
      const stamped = migrateModule.writeVersion(migrated, toVersion);
      await adapter.set(stamped);
      return { ranFrom: fromVersion, ranTo: toVersion, migrated: true };
    }

    return {
      getSettings,
      setSettings,
      onChange,
      getSchema,
      migrate,
      // Escape hatches — handy for tests and edge cases. Not part of the
      // documented surface but stable across versions.
      _adapter: adapter,
      _schema: schema,
    };
  }

  // ---- default instance shortcuts ----
  //
  // Build a lazily-initialized default instance so importing this module in
  // a Node test context doesn't throw "No storage adapter available" at
  // load time. Browser callers can use the shortcuts; tests should use
  // createSettings({ adapter }) explicitly.

  let _default = null;
  function defaultInstance() {
    if (!_default) _default = createSettings();
    return _default;
  }

  const moduleExports = {
    createSettings,
    // Shortcuts that lazily use the default instance.
    getSettings: () => defaultInstance().getSettings(),
    setSettings: (patch) => defaultInstance().setSettings(patch),
    onChange: (listener) => defaultInstance().onChange(listener),
    getSchema: () => defaultInstance().getSchema(),
    migrate: () => defaultInstance().migrate(),
    // Adapter registry (Registry/Catalog pattern). Extensions can pick a
    // specific one if they want to override detection.
    adapters: {
      get chrome() {
        return getDep("adapter-chrome");
      },
      get firefox() {
        return getDep("adapter-firefox");
      },
      get memory() {
        return getDep("adapter-memory").createMemoryAdapter;
      },
    },
    detectAdapter,
  };

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = moduleExports;
  } else {
    global.RiahSettings = global.RiahSettings || {};
    Object.assign(global.RiahSettings, moduleExports);
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this
);
