/**
 * Tests for shared/settings/adapter-memory.js
 *
 * The memory adapter is the test fixture for the facade tests, but it has
 * its own surface that needs verifying first (the chrome/firefox adapters
 * are integration-tested manually by loading the built extension).
 */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryAdapter } = require("../adapter-memory");

test("createMemoryAdapter() returns isolated instances", async () => {
  const a = createMemoryAdapter();
  const b = createMemoryAdapter();
  await a.set({ k: "in-a" });
  const inB = await b.get(["k"]);
  assert.deepEqual(inB, {});
});

test("get() with null returns the full store", async () => {
  const a = createMemoryAdapter({ a: 1, b: 2 });
  const all = await a.get(null);
  assert.deepEqual(all, { a: 1, b: 2 });
});

test("get() with a defaults object falls back to defaults for missing keys", async () => {
  const a = createMemoryAdapter({ existing: "yes" });
  const result = await a.get({ existing: "no", missing: "fallback" });
  assert.deepEqual(result, { existing: "yes", missing: "fallback" });
});

test("get() with a string returns just that key, or {} if absent", async () => {
  const a = createMemoryAdapter({ foo: 1 });
  assert.deepEqual(await a.get("foo"), { foo: 1 });
  assert.deepEqual(await a.get("nope"), {});
});

test("get() with an array returns only the keys that exist", async () => {
  const a = createMemoryAdapter({ x: 1, y: 2 });
  assert.deepEqual(await a.get(["x", "z"]), { x: 1 });
});

test("set() rejects non-object patches", async () => {
  const a = createMemoryAdapter();
  await assert.rejects(() => a.set(null), /plain object/);
  await assert.rejects(() => a.set([]), /plain object/);
  await assert.rejects(() => a.set("string"), /plain object/);
});

test("set() returns deep copies — caller can't mutate the store", async () => {
  const a = createMemoryAdapter();
  const arr = ["a"];
  await a.set({ list: arr });
  arr.push("b"); // mutate the original
  const out = await a.get(["list"]);
  assert.deepEqual(out.list, ["a"]);
});

test("onChanged() fires synchronously on set()", async () => {
  const a = createMemoryAdapter();
  const calls = [];
  const unsub = a.onChanged((changes, areaName) => {
    calls.push({ changes, areaName });
  });
  await a.set({ foo: "bar" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].areaName, "sync");
  assert.equal(calls[0].changes.foo.newValue, "bar");
  assert.equal(calls[0].changes.foo.oldValue, undefined);
  unsub();
  await a.set({ foo: "baz" });
  assert.equal(calls.length, 1, "unsubscribe should stop further calls");
});

test("onChanged() fires on remove() with oldValue but no newValue", async () => {
  const a = createMemoryAdapter({ gone: "soon" });
  let captured = null;
  a.onChanged((changes) => {
    captured = changes;
  });
  await a.remove("gone");
  assert.equal(captured.gone.oldValue, "soon");
  assert.equal(captured.gone.newValue, undefined);
});

test("clear() empties the store and reports removals", async () => {
  const a = createMemoryAdapter({ a: 1, b: 2 });
  let captured = null;
  a.onChanged((changes) => {
    captured = changes;
  });
  await a.clear();
  const after = await a.get(null);
  assert.deepEqual(after, {});
  assert.ok("a" in captured && "b" in captured);
});

test("a throwing listener doesn't stop other listeners", async () => {
  const a = createMemoryAdapter();
  const calls = [];
  a.onChanged(() => {
    throw new Error("boom");
  });
  a.onChanged((changes) => {
    calls.push(changes);
  });
  await a.set({ x: 1 });
  assert.equal(calls.length, 1);
});

test("isAvailable() always returns true", () => {
  const a = createMemoryAdapter();
  assert.equal(a.isAvailable(), true);
});
