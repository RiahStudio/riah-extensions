(function () {
  const host = location.hostname.toLowerCase();
  function isBypassedHost(host) {
    if (!host) {
      return false;
    }
    host = String(host).toLowerCase();
    if (typeof isRiahQuietHost === "function" && isRiahQuietHost(host)) {
      return true;
    }
    if (
      host === "whatsapp.com" ||
      host.endsWith(".whatsapp.com") ||
      host === "whatsapp.net" ||
      host.endsWith(".whatsapp.net")
    ) {
      return true;
    }
    if (host.startsWith("music.amazon.")) {
      return true;
    }
    if (
      host === "music.apple.com" ||
      host.endsWith(".music.apple.com") ||
      host === "podcasts.apple.com" ||
      host.endsWith(".podcasts.apple.com") ||
      host === "music.yandex.ru" ||
      host.endsWith(".music.yandex.ru") ||
      host === "music.yandex.com" ||
      host.endsWith(".music.yandex.com") ||
      host === "music.163.com" ||
      host.endsWith(".music.163.com") ||
      host === "sounds.bbc.co.uk"
    ) {
      return true;
    }
    const domains = [
      "youtube.com",
      "youtube-nocookie.com",
      "youtu.be",
      "soundcloud.com",
      "sndcdn.com",
      "spotify.com",
      "scdn.co",
      "bandcamp.com",
      "bcbits.com",
      "mixcloud.com",
      "tidal.com",
      "deezer.com",
      "pandora.com",
      "audiomack.com",
      "hearthis.at",
      "iheart.com",
      "tunein.com",
      "nts.live",
      "mixlr.com",
      "beatport.com",
      "qobuz.com",
      "idagio.com",
      "anghami.com",
      "jiosaavn.com",
      "gaana.com",
      "kkbox.com",
      "boomplay.com",
      "audius.co",
      "last.fm",
      "jamendo.com",
      "reverbnation.com",
      "somafm.com",
      "di.fm",
      "siriusxm.com",
      "audacy.com",
      "pocketcasts.com",
      "overcast.fm",
      "player.fm",
      "podbean.com",
      "fountain.fm",
      "radio.net",
      "radio.garden",
      "napster.com",
      "live365.com"
    ];
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i];
      if (host === domain || host.endsWith("." + domain)) {
        return true;
      }
    }
    return false;
  }
  if (isBypassedHost(host)) {
    return;
  }

  let pageGestured = false;
  function noteGesture() {
    pageGestured = true;
  }
  document.addEventListener("pointerdown", noteGesture, { capture: true, passive: true });
  document.addEventListener("keydown", noteGesture, { capture: true, passive: true });
  document.addEventListener("touchstart", noteGesture, { capture: true, passive: true });

  function storageGet(defaults) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(defaults, (value) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve(value);
      });
    });
  }

  // A plain string reaches the page script in Chrome and Firefox. An object made
  // here is sealed off from the page in Firefox, so reading it there throws.
  function sendConfig(allowed) {
    document.dispatchEvent(
      new CustomEvent("riah-autoplay-guard-config", {
        detail: allowed ? "allowed" : "blocked"
      })
    );
  }

  function processMedia(root, allowed) {
    if (allowed || pageGestured || !root) {
      return;
    }
    if (root.nodeType === 1) {
      const tag = root.tagName;
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "LINK" || tag === "META") {
        return;
      }
    } else if (root.nodeType !== 9 && root.nodeType !== 11) {
      return;
    }

    const nodes = [];
    if (root.matches?.("audio,video")) {
      nodes.push(root);
    }
    if (root.querySelectorAll) {
      nodes.push(...root.querySelectorAll("audio,video"));
    }

    for (const media of nodes) {
      media.autoplay = false;
      media.removeAttribute("autoplay");
    }
  }

  storageGet({ allowedHosts: [] })
    .then(({ allowedHosts }) => {
      const host = location.hostname;
      const allowed = Array.isArray(allowedHosts) && allowedHosts.includes(host);
      sendConfig(allowed);
      processMedia(document, allowed);

      document.addEventListener("DOMContentLoaded", () => processMedia(document.body, allowed), {
        once: true
      });

      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              processMedia(node, allowed);
            }
          }
        }
      }).observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    })
    .catch((error) => console.warn(error.message));
})();
