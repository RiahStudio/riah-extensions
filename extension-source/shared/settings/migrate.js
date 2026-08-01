/**
 * migrate.js — version-aware migration runner.
 *
 * Migrations are pure functions: (oldSettings) => newSettings. They run in
 * order: index 0 migrates v0 → v1, index 1 migrates v1 → v2, etc. The runner
 * inspects the stored `_settingsVersion` field and applies migrations from
 * (storedVersion) up to (targetVersion = schema.version).
 *
 * Why pure functions: easy to test, easy to compose, easy to reason about.
 * No side effects, no async — just data in, data out. The adapter handles
 * persistence; the migration runner handles transformation.
 *
 * Universal module: Node CommonJS + browser script tag.
 */
(function (global) {
  "use strict";

  /**
   * The migration registry. Index N migrates schema version N → N+1.
   *
   * MIGRATIONS[0]: no-op migration demonstrating the pattern. Real
   * migrations would, e.g., rename a key, change a type, or split a value.
   * Always return a fresh object — don't mutate the input.
   */
  const MIGRATIONS = [
    /**
     * v0 → v1: identity. Reserved as the bootstrap migration so installs
     * predating the schema-version field land on v1 cleanly. New migrations
     * should be APPENDED, never inserted, to keep version numbers stable.
     */
    function migration_v0_to_v1(old) {
      return { ...old };
    },
  ];

  /**
   * Run migrations from `fromVersion` to `toVersion`. Returns a new settings
   * object. Throws if a required migration index is missing (which indicates
   * a schema-version bump without a paired migration).
   */
  function runMigrations(settings, fromVersion, toVersion) {
    if (fromVersion === toVersion) return { ...settings };
    if (fromVersion > toVersion) {
      throw new Error(
        `Cannot downgrade settings (from v${fromVersion} to v${toVersion}). Re-install or wipe storage.`
      );
    }
    let current = { ...settings };
    for (let v = fromVersion; v < toVersion; v++) {
      const migration = MIGRATIONS[v];
      if (typeof migration !== "function") {
        throw new Error(
          `Missing migration for schema v${v} → v${v + 1}. Add it to MIGRATIONS in shared/settings/migrate.js.`
        );
      }
      current = migration(current);
    }
    return current;
  }

  /**
   * Detect the version stored alongside the settings. If absent, treat as 0
   * (fresh install, or pre-versioning data).
   */
  const VERSION_KEY = "_settingsVersion";

  function readVersion(stored) {
    if (!stored || typeof stored !== "object") return 0;
    const v = stored[VERSION_KEY];
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  }

  function writeVersion(settings, version) {
    return { ...settings, [VERSION_KEY]: version };
  }

  const moduleExports = {
    MIGRATIONS,
    runMigrations,
    readVersion,
    writeVersion,
    VERSION_KEY,
  };

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = moduleExports;
  } else {
    global.RiahSettings = global.RiahSettings || {};
    global.RiahSettings.migrate = moduleExports;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this
);
