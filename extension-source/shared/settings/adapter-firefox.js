/**
 * adapter-firefox.js — browser.storage.sync wrapper, Promise-returning.
 *
 * Firefox's WebExtension API uses `browser.*` and is Promise-native. We
 * could call it directly without a wrapper, but going through this adapter
 * gives us:
 *   1. A single interface shape (matches adapter-chrome and adapter-memory)
 *   2. A place to add Firefox-specific quirks if any emerge (e.g. quota
 *      handling, sync-vs-local fallback).
 *
 * Per ARCHITECTURE.md, we prefer chrome.* everywhere because Firefox
 * supports it as a shim. This adapter is provided for cases where an
 * extension wants the native browser.* surface (or for testing the
 * Promise-native path explicitly). The facade in index.js picks one
 * adapter at construction time; most extensions will use adapter-chrome
 * because it works in both runtimes via Firefox's chrome.* shim.
 */
(function (global) {
  "use strict";

  function getApi() {
    return global.browser && global.browser.storage && global.browser.storage.sync;
  }

  function get(keysOrDefaults) {
    const api = getApi();
    if (!api) return Promise.reject(new Error("browser.storage.sync not available"));
    // Firefox's browser.storage.sync.get returns a Promise natively.
    return Promise.resolve(api.get(keysOrDefaults == null ? null : keysOrDefaults));
  }

  function set(patch) {
    const api = getApi();
    if (!api) return Promise.reject(new Error("browser.storage.sync not available"));
    return Promise.resolve(api.set(patch));
  }

  function remove(keys) {
    const api = getApi();
    if (!api) return Promise.reject(new Error("browser.storage.sync not available"));
    return Promise.resolve(api.remove(keys));
  }

  function clear() {
    const api = getApi();
    if (!api) return Promise.reject(new Error("browser.storage.sync not available"));
    return Promise.resolve(api.clear());
  }

  function onChanged(listener) {
    const events =
      global.browser && global.browser.storage && global.browser.storage.onChanged;
    if (!events || typeof events.addListener !== "function") {
      return function unsubscribe() {};
    }
    const wrapped = (changes, areaName) => {
      if (areaName !== "sync") return;
      listener(changes, areaName);
    };
    events.addListener(wrapped);
    return function unsubscribe() {
      events.removeListener(wrapped);
    };
  }

  const moduleExports = {
    name: "firefox",
    get,
    set,
    remove,
    clear,
    onChanged,
    isAvailable: () => !!getApi(),
  };

  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = moduleExports;
  } else {
    global.RiahSettings = global.RiahSettings || {};
    global.RiahSettings.adapterFirefox = moduleExports;
  }
})(
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : this
);
