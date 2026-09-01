"use strict";

if (typeof importScripts === "function" && typeof RIAH_ENGLISH_SEARCH === "undefined") {
  importScripts("rewrite.js");
}

function isYoutubeHost(urlString) {
  try {
    var host = new URL(urlString).hostname.toLowerCase();
    return host === "youtube.com" || host.endsWith(".youtube.com");
  } catch (error) {
    return false;
  }
}

function maybeRedirect(details) {
  if (!details || details.frameId !== 0 || !RIAH_ENGLISH_SEARCH) {
    return;
  }
  // tabs.update on YouTube watch/playlist navigations reloads the player
  // between songs. Search language on YouTube is headers + /results only.
  if (isYoutubeHost(details.url)) {
    return;
  }
  var next = RIAH_ENGLISH_SEARCH.rewrite(details.url);
  if (!next) {
    return;
  }
  chrome.tabs.update(details.tabId, { url: next });
}

chrome.webNavigation.onBeforeNavigate.addListener(maybeRedirect, {
  url: [
    { hostContains: "google." },
    { hostContains: "bing.com" },
    { hostContains: "duckduckgo.com" },
    { hostContains: "amazon." },
    { hostEquals: "search.brave.com" },
    { hostEquals: "chromewebstore.google.com" }
  ]
});
