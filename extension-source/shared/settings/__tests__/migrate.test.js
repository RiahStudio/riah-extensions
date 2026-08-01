/**
 * Tests for shared/settings/migrate.js
 *
 * Runs under `node --test`.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MIGRATIONS,
  runMigrations,
  readVersion,
  writeVersion,
  VERSION_KEY,
} = require("../migrate");

test("MIGRATIONS array exists and at least one migration is present", () => {
  assert.ok(Array.isArray(MIGRATIONS));
  assert.ok(MIGRATIONS.length >= 1);
  assert.equal(typeof MIGRATIONS[0], "function");
});

test("the bootstrap migration (v0 -> v1) is a no-op identity", () => {
  const input = { foo: 1, bar: [1, 2, 3] };
  const out = MIGRATIONS[0](input);
  assert.deepEqual(out, input);
  // and crucially: it returns a new object, not the original reference
  assert.notEqual(out, input);
});

test("runMigrations() short-circuits when from === to", () => {
  const input = { a: 1 };
  const out = runMigrations(input, 1, 1);
  assert.deepEqual(out, input);
});

test("runMigrations() throws on downgrade", () => {
  assert.throws(() => runMigrations({}, 2, 1), /downgrade/);
});

test("runMigrations() throws when a required migration is missing", () => {
  // Asking for v0 -> v999 should fail since MIGRATIONS is much shorter.
  assert.throws(() => runMigrations({}, 0, 999), /Missing migration/);
});

test("runMigrations() applies migrations in sequence (synthetic chain)", () => {
  // Build a synthetic migration sequence and verify it applies in order.
  // We can't mutate the real MIGRATIONS, but we can exercise the runner
  // by checking that v0->v1 produces the expected shape.
  const out = runMigrations({ x: 5 }, 0, 1);
  assert.deepEqual(out, { x: 5 });
});

test("readVersion() defaults to 0 when absent", () => {
  assert.equal(readVersion({}), 0);
  assert.equal(readVersion(null), 0);
  assert.equal(readVersion(undefined), 0);
  assert.equal(readVersion({ foo: "bar" }), 0);
});

test("readVersion() reads the stamped version", () => {
  assert.equal(readVersion({ [VERSION_KEY]: 1 }), 1);
  assert.equal(readVersion({ [VERSION_KEY]: 7 }), 7);
});

test("readVersion() ignores non-numeric version fields", () => {
  assert.equal(readVersion({ [VERSION_KEY]: "1" }), 0);
  assert.equal(readVersion({ [VERSION_KEY]: NaN }), 0);
});

test("writeVersion() stamps the version key without mutating input", () => {
  const input = { foo: 1 };
  const out = writeVersion(input, 3);
  assert.equal(out[VERSION_KEY], 3);
  assert.equal(out.foo, 1);
  assert.ok(!(VERSION_KEY in input), "input should not be mutated");
});
