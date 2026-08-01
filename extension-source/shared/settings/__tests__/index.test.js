/**
 * Tests for shared/settings/index.js — the facade.
 *
 * All tests run against the memory adapter so they're hermetic and fast.
 * The chrome/firefox adapters are integration-tested manually by loading
 * the built extension.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSettings } = require("../index");
const { createMemoryAdapter } = require("../adapter-memory");
const { DEFAULT_SCHEMA } = require("../schema");
const { VERSION_KEY } = require("../migrate");

function makeSettings(initial) {
  return createSettings({
    adapter: createMemoryAdapter(initial),
    schema: DEFAULT_SCHEMA,
  });
}

test("getSettings() returns schema defaults on a fresh store", async () => {
  const s = makeSettings();
  const out = await s.getSettings();
  assert.deepEqual(out["disabledHosts"], []);
});

test("setSettings() persists and getSettings() reads back", async () => {
  const s = makeSettings();
  await s.setSettings({
    "disabledHosts": ["bank.example", "court.example"],
  });
  const out = await s.getSettings();
  assert.deepEqual(out["disabledHosts"], [
    "bank.example",
    "court.example",
  ]);
});

test("setSettings() throws on a type mismatch", async () => {
  const s = makeSettings();
  await assert.rejects(
    () =>
      s.setSettings({
        "disabledHosts": "not-an-array",
      }),
    /failed validation/
  );
});

test("setSettings() with an unknown key does NOT throw (forward-compat)", async () => {
  const s = makeSettings();
  // Unknown keys are tolerated — the schema may lag behind the codebase.
  await s.setSettings({ "futureExt.something": 42 });
  const out = await s.getSettings();
  // Defaults still come through. The unknown key was passed to the
  // adapter but withDefaults() filters it out on read.
  assert.deepEqual(out["disabledHosts"], []);
});

test("onChange() fires on set, returns an unsubscribe function", async () => {
  const s = makeSettings();
  const changes = [];
  const unsub = s.onChange((c) => changes.push(c));
  await s.setSettings({
    "disabledHosts": ["x.example"],
  });
  assert.equal(changes.length, 1);
  assert.deepEqual(
    changes[0]["disabledHosts"].newValue,
    ["x.example"]
  );
  assert.equal(typeof unsub, "function");
  unsub();
  await s.setSettings({
    "disabledHosts": ["y.example"],
  });
  assert.equal(changes.length, 1, "no fire after unsubscribe");
});

test("getSchema() returns the schema reference passed in", () => {
  const s = makeSettings();
  assert.equal(s.getSchema(), DEFAULT_SCHEMA);
});

test("migrate() stamps the schema version on a fresh store", async () => {
  const s = makeSettings();
  const result = await s.migrate();
  assert.equal(result.ranFrom, 0);
  assert.equal(result.ranTo, DEFAULT_SCHEMA.version);
  assert.equal(result.migrated, true);
  // Subsequent migrate() is a no-op.
  const second = await s.migrate();
  assert.equal(second.migrated, false);
});

test("migrate() is idempotent — running twice doesn't re-run migrations", async () => {
  const s = makeSettings({ [VERSION_KEY]: DEFAULT_SCHEMA.version });
  const result = await s.migrate();
  assert.equal(result.migrated, false);
  assert.equal(result.ranFrom, DEFAULT_SCHEMA.version);
});

test("migrate() persists the version stamp so the next reader sees it", async () => {
  const adapter = createMemoryAdapter();
  const s = createSettings({ adapter, schema: DEFAULT_SCHEMA });
  await s.migrate();
  const raw = await adapter.get(null);
  assert.equal(raw[VERSION_KEY], DEFAULT_SCHEMA.version);
});

test("createSettings() works with no options when an adapter is detectable — and throws otherwise in Node", () => {
  // In a bare Node context there's no chrome/browser global, so calling
  // createSettings() without an adapter should throw via detectAdapter().
  assert.throws(() => {
    // We must actually trigger detection — happens inside getSettings().
    const s = createSettings();
    // Force detection now:
    return s._adapter;
  }, /No storage adapter/);
});

test("integration: a write fires onChange with a shape the listener can route on", async () => {
  const s = makeSettings({
    "disabledHosts": ["already.example"],
  });
  let captured = null;
  s.onChange((changes) => {
    captured = changes;
  });
  await s.setSettings({
    "disabledHosts": ["already.example", "new.example"],
  });
  assert.deepEqual(captured["disabledHosts"].oldValue, [
    "already.example",
  ]);
  assert.deepEqual(captured["disabledHosts"].newValue, [
    "already.example",
    "new.example",
  ]);
});
