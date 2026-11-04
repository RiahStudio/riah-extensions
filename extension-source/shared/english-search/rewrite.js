var RIAH_ENGLISH_SEARCH = (function () {
  "use strict";

  var ACCEPT_LANGUAGE = "en-US,en;q=0.9";

  var SKIP_GOOGLE_HOST =
    /(^|\.)(accounts|mail|docs|drive|calendar|meet|chat|classroom|admin|myaccount)\.google\.com$/i;

  var GOOGLE_SEARCH_PATH =
    /^\/($|ncr$|search|webhp|imghp|shopping|maps|videohp|news)/i;

  function hostname(url) {
    return String(url.hostname || "").toLowerCase();
  }

  function isThaiGoogleHost(host) {
    return /(^|\.)google\.co\.th$/.test(host);
  }

  function isGoogleHost(host) {
    return /(^|\.)google\.com$/.test(host) || isThaiGoogleHost(host);
  }

  function englishGoogleHost(host) {
    return host.replace(/\.co\.th$/i, ".com");
  }

  function setParam(url, key, value) {
    if (url.searchParams.get(key) === value) {
      return false;
    }
    url.searchParams.set(key, value);
    return true;
  }

  function rewriteGoogle(url) {
    var host = hostname(url);
    if (SKIP_GOOGLE_HOST.test(host)) {
      return false;
    }

    var changed = false;
    if (isThaiGoogleHost(host)) {
      url.hostname = englishGoogleHost(host);
      changed = true;
      if (url.pathname === "/" || url.pathname === "") {
        url.pathname = "/ncr";
      }
    }

    host = hostname(url);
    if (host === "play.google.com") {
      changed = setParam(url, "hl", "en") || changed;
      changed = setParam(url, "gl", "US") || changed;
      return changed;
    }

    if (!GOOGLE_SEARCH_PATH.test(url.pathname)) {
      return changed;
    }

    changed = setParam(url, "hl", "en") || changed;
    changed = setParam(url, "gl", "us") || changed;
    if (url.pathname.indexOf("/search") === 0 || url.pathname.indexOf("/webhp") === 0) {
      changed = setParam(url, "lr", "lang_en") || changed;
    }
    return changed;
  }

  function isYoutubePlayerUrl(url) {
    var path = url.pathname || "";
    if (
      path === "/watch" ||
      path.indexOf("/watch/") === 0 ||
      path === "/shorts" ||
      path.indexOf("/shorts/") === 0 ||
      path.indexOf("/embed/") === 0 ||
      path.indexOf("/live") === 0
    ) {
      return true;
    }
    if (path.indexOf("/results") === 0) {
      return false;
    }
    if (url.searchParams.has("v") || url.searchParams.has("list")) {
      return true;
    }
    return false;
  }

  function rewriteYoutube(url) {
    var host = hostname(url);
    if (!/(^|\.)youtube\.com$/.test(host)) {
      return false;
    }
    // Never touch the player. Adding hl/gl mid-playlist reloads the tab.
    if (isYoutubePlayerUrl(url)) {
      return false;
    }
    if (url.pathname.indexOf("/results") !== 0) {
      return false;
    }
    var changed = setParam(url, "hl", "en");
    changed = setParam(url, "gl", "US") || changed;
    return changed;
  }

  function rewriteBing(url) {
    var host = hostname(url);
    if (!/(^|\.)bing\.com$/.test(host)) {
      return false;
    }
    if (url.pathname.indexOf("/search") !== 0 && url.pathname !== "/") {
      return false;
    }
    var changed = setParam(url, "setlang", "en");
    changed = setParam(url, "cc", "US") || changed;
    return changed;
  }

  function rewriteDuckDuckGo(url) {
    if (hostname(url) !== "duckduckgo.com") {
      return false;
    }
    return setParam(url, "kl", "us-en");
  }

  function rewriteAmazon(url) {
    var host = hostname(url);
    if (!/(^|\.)amazon\.com$/.test(host) && !/(^|\.)amazon\.co\.th$/.test(host)) {
      return false;
    }
    return setParam(url, "language", "en_US");
  }

  function rewriteChromeWebStore(url) {
    if (hostname(url) !== "chromewebstore.google.com") {
      return false;
    }
    return setParam(url, "hl", "en");
  }

  function shouldSkipHost(host) {
    return SKIP_GOOGLE_HOST.test(String(host || "").toLowerCase());
  }

  function rewrite(href) {
    var url;
    try {
      url = new URL(href);
    } catch (error) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    var changed = false;
    var host = hostname(url);

    if (host === "chromewebstore.google.com") {
      changed = rewriteChromeWebStore(url);
    } else if (isGoogleHost(host)) {
      changed = rewriteGoogle(url);
    } else if (rewriteYoutube(url)) {
      changed = true;
    } else if (rewriteBing(url)) {
      changed = true;
    } else if (rewriteDuckDuckGo(url)) {
      changed = true;
    } else if (rewriteAmazon(url)) {
      changed = true;
    }

    if (!changed) {
      return null;
    }
    return url.toString();
  }

  return {
    ACCEPT_LANGUAGE: ACCEPT_LANGUAGE,
    rewrite: rewrite,
    shouldSkipHost: shouldSkipHost
  };
})();

if (typeof module === "object" && module.exports) {
  module.exports = RIAH_ENGLISH_SEARCH;
}
