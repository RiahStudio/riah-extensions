/**
 * Tests for shared/settings/schema.js
 *
 * Runs under Node's built-in test runner: `node --test`.
 * No third-party deps; uses node:test + node:assert.
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const schemaModule = require("../schema");

const { DEFAULT_SCHEMA, TYPE_VALIDATORS, validate, defaults, withDefaults } =
  schemaModule;

test("DEFAULT_SCHEMA carries a numeric version", () => {
  assert.equal(typeof DEFAULT_SCHEMA.version, "number");
  assert.ok(DEFAULT_SCHEMA.version >= 1);
});

test("DEFAULT_SCHEMA's disabledHosts field is a string-array with [] default", () => {
  const field = DEFAULT_SCHEMA.fields.disabledHosts;
  assert.ok(field, "field exists");
  assert.equal(field.type, "string-array");
  assert.deepEqual(field.default, []);
  assert.equal(typeof field.validate, "function");
});

test("TYPE_VALIDATORS reject obviously-wrong values", () => {
  assert.equal(TYPE_VALIDATORS.boolean("yes"), false);
  assert.equal(TYPE_VALIDATORS.number(NaN), false);
  assert.equal(TYPE_VALIDATORS.number(Infinity), false);
  assert.equal(TYPE_VALIDATORS.string(42), false);
  assert.equal(TYPE_VALIDATORS["string-array"](["a", 2]), false);
  assert.equal(TYPE_VALIDATORS.object([]), false);
  assert.equal(TYPE_VALIDATORS.object(null), false);
});

test("TYPE_VALIDATORS accept valid values", () => {
  assert.equal(TYPE_VALIDATORS.boolean(true), true);
  assert.equal(TYPE_VALIDATORS.number(0), true);
  assert.equal(TYPE_VALIDATORS.string(""), true);
  assert.equal(TYPE_VALIDATORS["string-array"]([]), true);
  assert.equal(TYPE_VALIDATORS["string-array"](["a", "b"]), true);
  assert.equal(TYPE_VALIDATORS.object({}), true);
});

test("validate() flags failures with descriptive messages", () => {
  const result = validate(
    { disabledHosts: "not-an-array" },
    DEFAULT_SCHEMA
  );
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 1);
  assert.match(result.errors[0], /disabledHosts/);
});

test("validate() ignores unknown keys (forward-compat)", () => {
  const result = validate(
    { "futureExtension.someField": 123 },
    DEFAULT_SCHEMA
  );
  assert.equal(result.ok, true);
});

test("defaults() returns a deep copy — mutating the result is safe", () => {
  const a = defaults(DEFAULT_SCHEMA);
  a.disabledHosts.push("evil.example");
  const b = defaults(DEFAULT_SCHEMA);
  assert.deepEqual(b.disabledHosts, []);
});

test("withDefaults() fills missing fields from the schema", () => {
  const merged = withDefaults({}, DEFAULT_SCHEMA);
  assert.deepEqual(merged.disabledHosts, []);
});

test("withDefaults() preserves stored values that ARE present", () => {
  const merged = withDefaults(
    { disabledHosts: ["a.com"] },
    DEFAULT_SCHEMA
  );
  assert.deepEqual(merged.disabledHosts, ["a.com"]);
});

test("withDefaults() drops unknown keys", () => {
  const merged = withDefaults(
    { disabledHosts: ["a"], junk: 1 },
    DEFAULT_SCHEMA
  );
  assert.ok(!("junk" in merged));
});
