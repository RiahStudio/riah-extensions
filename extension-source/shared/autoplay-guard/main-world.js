(function () {
  const host = location.hostname.toLowerCase();
  function isBypassedHost(host) {
    if (!host) {
      return false;
    }
    host = String(host).toLowerCase();
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

  if (window.__riahAutoplayGuardInstalled) {
    return;
  }
  window.__riahAutoplayGuardInstalled = true;

  const originalPlay = HTMLMediaElement.prototype.play;
  let allowed = false;
  let sessionUnlocked = false;
  let pageGestured = false;

  function noteGesture() {
    pageGestured = true;
  }

  document.addEventListener("pointerdown", noteGesture, { capture: true, passive: true });
  document.addEventListener("keydown", noteGesture, { capture: true, passive: true });
  document.addEventListener("touchstart", noteGesture, { capture: true, passive: true });

  function blockExistingAutoplay() {
    for (const media of document.querySelectorAll("audio,video")) {
      media.autoplay = false;
      media.removeAttribute("autoplay");
    }
  }

  HTMLMediaElement.prototype.play = function () {
    const gestured = !navigator.userActivation || navigator.userActivation.isActive;
    if (allowed || pageGestured || sessionUnlocked || gestured) {
      if (gestured || pageGestured) {
        sessionUnlocked = true;
      }
      return originalPlay.apply(this, arguments);
    }

    return Promise.reject(
      new DOMException("Autoplay blocked by Riah extension", "NotAllowedError")
    );
  };

  document.addEventListener("riah-autoplay-guard-config", (event) => {
    allowed = !!event.detail?.allowed;
    if (!allowed) {
      blockExistingAutoplay();
    }
  });

  if (document.readyState !== "loading") {
    blockExistingAutoplay();
  } else {
    document.addEventListener("DOMContentLoaded", blockExistingAutoplay, { once: true });
  }
})();
