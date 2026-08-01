/**
 * adapter-chrome.js — chrome.storage.sync wrapper, Promise-returning.
 *
 * Normalizes the callback-vs-promise difference across Chrome MV2/MV3.
 * Chrome MV3 returns Promises natively from chrome.storage.sync.get/set, but
 * older code (and some MV2 callsites we may inherit) uses the callback form
 * + chrome.runtime.lastError. This wrapper handles both: we always pass a
 * callback, and we always return a Promise. If the underlying API already
 * returned a thenable, we resolve through that; otherwise we resolve in the
 * callback. Either way the caller gets a Promise.
 *
 * Why not the WebExtension polyfill? Per ARCHITECTURE.md: "use chrome.*
 * everywhere. Firefox supports it. If a specific extension needs a Promise
 * API Chrome doesn't expose, wrap the callback form in a Promise — don't
 * import a polyfill." This file is that wrapper.
 */
(function (global) {
  "use strict";

  /**
   * Internal: invoke a chrome.storage.sync method and return a Promise.
   * Always checks chrome.runtime.lastError because Chrome's promise form
   * STILL swallows certain quota errors that only surface through lastError.
   */
  function call(method, ...args) {
    return new Promise((resolve, reject) => {
      try {
        const api = global.chrome && global.chrome.storage && global.chrome.storage.sync;
        if (!api || typeof api[method] !== "function") {
          reject(
            new Error(
              `chrome.storage.sync.${method} not available — adapter-chrome used in wrong runtime?`
            )
          );
          return;
        }
        const result = api[method](...args, (value) => {
          const err =
            global.chrome.runtime && global.chrome.runtime.lastError;
          if (err) {
            reject(new Error(err.message || String(err)));
            return;
          }
          resolve(value);
        });
        // If the runtime returned a Promise directly (MV3 native), chain it.
        // The callback path will still resolve us, so we race — first to
        // resolve wins. In practice MV3 calls both paths idempotently.
        if (result && typeof result.then === "function") {
          result.then(resolve, reject);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  function get(keysOrDefaults) {
    // chrome.storage.sync.get accepts: null (all), string, string[], or object
    // (key→default). We pass through; callers usually pass an object.
    return call("get", keysOrDefaults == null ? null : keysOrDefaults);
  }

  function set(patch) {
    return call("set", patch);
  }

  function remove(keys) {
    return call("remove", keys);
  }

  function clear() {
    return call("clear");
  }

  /**
   * Subscribe to changes. Returns an unsubscribe function. The listener is
   * called with (changes, areaName) — same shape as chrome.storage.onChanged
   * but pre-filtered to areaName === "sync".
   */
  function onChanged(listener) {
    const api = global.chrome && global.chrome.storage && global.chrome.storage.onChanged;
    if (!api || typeof api.addListener !== "function") {
      // No-op: storage events unavailable in this runtime.
      return function unsubscribe() {};
    }
    const wrapped = (changes, areaName) => {
      if (areaName !== "sync") return;
      listener(changes, areaName);
    };
    api.addListener(wrapped);
    return function unsubscribe() {
      api.removeListener(wrapped);
    };
  }

  const moduleExports = {
    name: "chrome",
    get,
    set,
    remove,
    clear,
    onChanged,
    // Predicate to check whether this adapter can run in the current runtime.
    isAvailable: () => {
      return !!(
        global.chrome &&
        global.chrome.storage &&
        global.chrome.storage.sync &&
        global.chrome.runtime
      );
    },
  };

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = moduleExports;
  } else {
    global.RiahSettings = global.RiahSettings || {};
    global.RiahSettings.adapterChrome = moduleExports;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this
);
