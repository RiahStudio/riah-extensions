(function () {
  const host = location.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    return;
  }

  if (window.__riahAutoplayGuardInstalled) {
    return;
  }
  window.__riahAutoplayGuardInstalled = true;

  const originalPlay = HTMLMediaElement.prototype.play;
  let allowed = false;

  function blockExistingAutoplay() {
    for (const media of document.querySelectorAll("audio,video")) {
      media.autoplay = false;
      media.removeAttribute("autoplay");
    }
  }

  HTMLMediaElement.prototype.play = function () {
    if (allowed || !navigator.userActivation || navigator.userActivation.isActive) {
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
