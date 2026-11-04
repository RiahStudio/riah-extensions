(function () {
  "use strict";

  if (!RIAH_ENGLISH_SEARCH || typeof RIAH_ENGLISH_SEARCH.rewrite !== "function") {
    return;
  }

  // rewrite() already refuses these hosts. Patching history on Gmail, Docs,
  // Accounts, and the rest is risk with no benefit, so bail before installing
  // anything at all.
  if (
    typeof RIAH_ENGLISH_SEARCH.shouldSkipHost === "function" &&
    RIAH_ENGLISH_SEARCH.shouldSkipHost(location.hostname)
  ) {
    return;
  }

  var applying = false;

  function apply() {
    if (applying) {
      return;
    }
    var path = location.pathname || "";
    if (
      path === "/watch" ||
      path.indexOf("/watch/") === 0 ||
      path === "/shorts" ||
      path.indexOf("/shorts/") === 0 ||
      path.indexOf("/embed/") === 0
    ) {
      return;
    }
    var next = RIAH_ENGLISH_SEARCH.rewrite(location.href);
    if (!next) {
      return;
    }
    applying = true;
    try {
      var from = new URL(location.href);
      var to = new URL(next);
      if (from.host !== to.host) {
        location.replace(next);
        return;
      }
      if (from.pathname !== to.pathname || from.search !== to.search) {
        history.replaceState(history.state, "", next);
      }
    } finally {
      applying = false;
    }
  }

  var origPush = history.pushState;
  history.pushState = function () {
    var result = origPush.apply(this, arguments);
    apply();
    return result;
  };

  var origReplace = history.replaceState;
  history.replaceState = function () {
    var result = origReplace.apply(this, arguments);
    apply();
    return result;
  };

  window.addEventListener("popstate", apply);
  window.addEventListener("yt-navigate-finish", apply);
  apply();
})();
