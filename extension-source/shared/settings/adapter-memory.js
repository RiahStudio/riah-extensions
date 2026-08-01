/**
 * adapter-memory.js — in-memory adapter for tests.
 *
 * Implements the same interface as adapter-chrome and adapter-firefox but
 * stores everything in a JS object. The store is exposed as `store` for
 * tests that need to inspect or seed state. Each call to createMemoryAdapter()
 * returns a fresh, isolated adapter so tests don't bleed state.
 *
 * Listeners are fired synchronously inside set/remove/clear, which is good
 * enough for tests (the real adapters fire asynchronously, but the contract
 * — "listeners get a changes object after a write lands" — holds).
 */
(function (global) {
  "use strict";

  /**
   * Factory. Returns an adapter instance. Multiple instances are independent.
   */
  function createMemoryAdapter(initial) {
    let store =
      initial && typeof initial === "object" ? deepCopy(initial) : {};
    const listeners = new Set();

    function deepCopy(v) {
      // Sufficient for JSON-serializable settings. Throws on cycles —
      // intentional, since settings should never have cycles.
      return JSON.parse(JSON.stringify(v));
    }

    function fireChanged(changes) {
      // Snapshot listeners so a listener that unsubscribes itself doesn't
      // mutate the set mid-iteration.
      const snapshot = Array.from(listeners);
      for (const fn of snapshot) {
        try {
          fn(changes, "sync");
        } catch (e) {
          // Match the real APIs: a throwing listener doesn't stop others.
          // eslint-disable-next-line no-console
          if (typeof console !== "undefined") console.error(e);
        }
      }
    }

    function get(keysOrDefaults) {
      if (keysOrDefaults == null) {
        return Promise.resolve(deepCopy(store));
      }
      if (typeof keysOrDefaults === "string") {
        return Promise.resolve(
          keysOrDefaults in store
            ? { [keysOrDefaults]: deepCopy(store[keysOrDefaults]) }
            : {}
        );
      }
      if (Array.isArray(keysOrDefaults)) {
        const out = {};
        for (const k of keysOrDefaults) {
          if (k in store) out[k] = deepCopy(store[k]);
        }
        return Promise.resolve(out);
      }
      if (typeof keysOrDefaults === "object") {
        // Object form: keys are field names, values are defaults if missing.
        const out = {};
        for (const [k, def] of Object.entries(keysOrDefaults)) {
          out[k] = k in store ? deepCopy(store[k]) : deepCopy(def);
        }
        return Promise.resolve(out);
      }
      return Promise.reject(
        new Error("memory adapter: unsupported get() argument")
      );
    }

    function set(patch) {
      if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
        return Promise.reject(
          new Error("memory adapter: set() requires a plain object")
        );
      }
      const changes = {};
      for (const [k, newValue] of Object.entries(patch)) {
        const oldValue = k in store ? deepCopy(store[k]) : undefined;
        store[k] = deepCopy(newValue);
        changes[k] = { oldValue, newValue: deepCopy(newValue) };
      }
      fireChanged(changes);
      return Promise.resolve();
    }

    function remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      const changes = {};
      for (const k of list) {
        if (k in store) {
          changes[k] = { oldValue: deepCopy(store[k]), newValue: undefined };
          delete store[k];
        }
      }
      if (Object.keys(changes).length) fireChanged(changes);
      return Promise.resolve();
    }

    function clear() {
      const changes = {};
      for (const [k, v] of Object.entries(store)) {
        changes[k] = { oldValue: deepCopy(v), newValue: undefined };
      }
      store = {};
      if (Object.keys(changes).length) fireChanged(changes);
      return Promise.resolve();
    }

    function onChanged(listener) {
      listeners.add(listener);
      return function unsubscribe() {
        listeners.delete(listener);
      };
    }

    return {
      name: "memory",
      get,
      set,
      remove,
      clear,
      onChanged,
      isAvailable: () => true,
      // Test-only: direct store access. Real adapters don't expose this.
      _store: () => store,
      _setStore: (next) => {
        store = next && typeof next === "object" ? deepCopy(next) : {};
      },
    };
  }

  const moduleExports = {
    createMemoryAdapter,
  };

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = moduleExports;
  } else {
    global.RiahSettings = global.RiahSettings || {};
    global.RiahSettings.adapterMemory = moduleExports;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this
);
