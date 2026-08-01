/**
 * schema.js — Riah Extensions shared settings schema.
 *
 * Each extension's settings live under a namespaced key (e.g.
 * "absoluteRightClick.disabledHosts"). The schema is a flat map: field key →
 * { type, default, validate }. The `version` is bumped whenever a migration
 * is needed; see migrate.js for the runner.
 *
 * Field types currently supported (hand-rolled, no zod):
 *   - "boolean"
 *   - "number"
 *   - "string"
 *   - "string-array"
 *   - "object"   (plain JSON-serializable object)
 *   - "any"      (no validation, escape hatch)
 *
 * Validators are pure (value) => boolean. Required. They run on every
 * setSettings() call; invalid values are rejected with a thrown Error.
 *
 * Universal module: works under Node (CommonJS, for unit tests) and under a
 * browser <script> tag (attaches to globalThis.RiahSettings.schema).
 */
(function (global) {
  "use strict";

  const SCHEMA_VERSION = 1;

  function isPlainObject(v) {
    return (
      v !== null &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) === Object.prototype
    );
  }

  const TYPE_VALIDATORS = {
    boolean: (v) => typeof v === "boolean",
    number: (v) => typeof v === "number" && Number.isFinite(v),
    string: (v) => typeof v === "string",
    "string-array": (v) =>
      Array.isArray(v) && v.every((x) => typeof x === "string"),
    object: (v) => isPlainObject(v),
    any: () => true,
  };

  /**
   * The default schema.
   *
   * One important design choice: field keys here use the same bare names
   * the extensions already write to chrome.storage.sync (e.g. "disabledHosts"
   * for Absolute Right Click) rather than a "<extName>.<field>" namespace.
   * Two reasons:
   *
   *   1. Each extension has its own chrome.storage.sync sandbox, so two
   *      extensions can both use a key called "disabledHosts" without ever
   *      colliding at the storage layer.
   *   2. The migration goal is to wrap existing storage, not relocate it.
   *      Re-keying would require a real data migration on every install.
   *
   * If two extensions DO want to share the same DEFAULT_SCHEMA and the keys
   * disagree, the right move is for the second extension to pass its own
   * schema via createSettings({ schema }) — see MIGRATION.md.
   */
  const DEFAULT_SCHEMA = {
    version: SCHEMA_VERSION,
    fields: {
      disabledHosts: {
        type: "string-array",
        default: [],
        validate: TYPE_VALIDATORS["string-array"],
        description:
          "Hosts where the extension's behavior is disabled (per-site opt-out). Used by Absolute Right Click.",
      },
    },
  };

  /**
   * Validate a settings object against a schema. Returns { ok, errors[] }.
   * Unknown keys are ignored (so extensions on older schemas don't crash
   * when storage has fields from a newer build).
   */
  function validate(settings, schema) {
    if (!isPlainObject(settings)) {
      return { ok: false, errors: ["settings must be a plain object"] };
    }
    const errors = [];
    for (const [key, value] of Object.entries(settings)) {
      const field = schema.fields[key];
      if (!field) continue; // unknown key — ignore, not error
      if (!field.validate(value)) {
        errors.push(`field "${key}" failed validation (type: ${field.type})`);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  /**
   * Build a defaults object from the schema. Used to seed storage on first
   * read, and to fill gaps when storage returns a partial object.
   */
  function defaults(schema) {
    const out = {};
    for (const [key, field] of Object.entries(schema.fields)) {
      // Deep-clone defaults so mutating returned settings doesn't poison the
      // schema. JSON round-trip is fine here because all defaults are
      // JSON-serializable by construction.
      out[key] = JSON.parse(JSON.stringify(field.default));
    }
    return out;
  }

  /**
   * Merge a (potentially partial) stored object with the schema defaults.
   * Returns a fresh object — does not mutate either argument.
   */
  function withDefaults(stored, schema) {
    const out = defaults(schema);
    if (!isPlainObject(stored)) return out;
    for (const [key, value] of Object.entries(stored)) {
      if (schema.fields[key]) {
        out[key] = value;
      }
    }
    return out;
  }

  const moduleExports = {
    SCHEMA_VERSION,
    DEFAULT_SCHEMA,
    TYPE_VALIDATORS,
    validate,
    defaults,
    withDefaults,
    isPlainObject,
  };

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = moduleExports;
  } else {
    global.RiahSettings = global.RiahSettings || {};
    global.RiahSettings.schema = moduleExports;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this
);
