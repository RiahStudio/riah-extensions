(function () {
  let applyToken = 0;
  let scheduled = false;

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

  function isWatchPage() {
    return location.pathname === "/watch";
  }

  function playerRoot() {
    return document.querySelector("#movie_player, .html5-video-player") || document;
  }

  function findAutoplayButton() {
    const root = playerRoot();
    const labeledButton = root.querySelector("button[aria-label*='Autoplay is']");
    if (labeledButton) {
      return labeledButton;
    }

    const toggle =
      root.querySelector(".ytp-autonav-toggle-button") ||
      root.querySelector("[aria-label*='Autoplay is']");
    return toggle?.closest?.("button") || toggle || null;
  }

  function findCaptionsButton() {
    const player = document.querySelector(".html5-video-player");
    if (!player) {
      return null;
    }

    const button = player.querySelector("button.ytp-subtitles-button.ytp-button");
    if (!button || button.tagName !== "BUTTON") {
      return null;
    }
    return button;
  }

  function turnCaptionsOff(button) {
    if (button?.getAttribute("aria-pressed") !== "true") {
      return false;
    }
    button.click();
    return true;
  }

  function readToggleState(button) {
    const ariaChecked = button.getAttribute("aria-checked");
    if (ariaChecked === "true" || ariaChecked === "false") {
      return ariaChecked === "true";
    }

    const ariaPressed = button.getAttribute("aria-pressed");
    if (ariaPressed === "true" || ariaPressed === "false") {
      return ariaPressed === "true";
    }

    const label = (button.getAttribute("aria-label") || button.title || "").toLowerCase();
    if (label.includes("autoplay is on") || label.includes("turn autoplay off")) {
      return true;
    }
    if (label.includes("autoplay is off") || label.includes("turn autoplay on")) {
      return false;
    }

    return button.classList.contains("ytp-autonav-toggle-button") &&
      !button.classList.contains("ytp-autonav-toggle-button-container")
      ? true
      : null;
  }

  function scheduleApply() {
    if (!isWatchPage()) {
      applyToken += 1;
      return;
    }

    if (scheduled) {
      return;
    }
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      applyPreferredState().catch((error) => console.warn(error.message));
    }, 250);
  }

  function forceButtonClick(button) {
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const style = window.getComputedStyle(button);
    const needsForce =
      style.display === "none" ||
      style.visibility === "hidden" ||
      rect.width === 0 ||
      rect.height === 0;
    const before = {
      display: button.style.display,
      visibility: button.style.visibility,
      pointerEvents: button.style.pointerEvents
    };

    if (needsForce) {
      button.style.setProperty("display", "block", "important");
      button.style.setProperty("visibility", "visible", "important");
      button.style.setProperty("pointer-events", "auto", "important");
    }

    button.click();

    if (needsForce) {
      button.style.display = before.display;
      button.style.visibility = before.visibility;
      button.style.pointerEvents = before.pointerEvents;
    }
  }

  async function applyPreferredState() {
    if (!isWatchPage()) {
      return;
    }

    const {
      autoplayEnabled = false,
      captionsOff = true
    } = await storageGet({ autoplayEnabled: false, captionsOff: true });
    const token = ++applyToken;
    let attempts = 0;

    const run = () => {
      if (token !== applyToken || !isWatchPage()) {
        return;
      }

      attempts += 1;
      const autoplayButton = findAutoplayButton();
      const autoplayState = autoplayButton ? readToggleState(autoplayButton) : null;
      const autoplayResolved =
        autoplayState !== null && autoplayState === autoplayEnabled;

      if (autoplayButton && autoplayState !== null && !autoplayResolved) {
        forceButtonClick(autoplayButton);
      }

      const captionsButton = findCaptionsButton();
      const captionsResolved =
        !captionsOff ||
        (captionsButton && captionsButton.getAttribute("aria-pressed") === "false");

      if (captionsOff && captionsButton) {
        turnCaptionsOff(captionsButton);
      }

      if ((!autoplayResolved || !captionsResolved) && attempts < 40) {
        setTimeout(run, 500);
      }
    };

    run();
  }

  // Open videos paused.
  //
  // The 0.1.0 autoplay stopper paused on every media insert, so YouTube also
  // paused on fullscreen, resize and player relayout. This holds the opening
  // frame only: at most one pause per watch page, only in the first seconds,
  // only when the user has not already touched the player, and never through a
  // page-wide observer, a style change or pointer interception.
  const HOLD_WINDOW_MS = 20000;
  const HOLD_MAX_SECONDS = 2;
  let holdWanted = false;
  let holdLoaded = false;
  let holdSpent = false;
  let holdArmedAt = Date.now();
  let holdPending = null;
  let playerTouched = false;

  function insidePlayer(node) {
    return !!node?.closest?.("#movie_player, .html5-video-player");
  }

  function armHold() {
    holdSpent = false;
    holdArmedAt = Date.now();
    holdPending = null;
    playerTouched = false;
  }

  function runHold() {
    const video = holdPending;
    if (!holdLoaded || !holdWanted || holdSpent || !video) {
      return;
    }

    holdPending = null;
    holdSpent = true;

    if (
      playerTouched ||
      !isWatchPage() ||
      Date.now() - holdArmedAt > HOLD_WINDOW_MS ||
      video.currentTime > HOLD_MAX_SECONDS
    ) {
      return;
    }

    video.pause();
  }

  document.addEventListener(
    "play",
    (event) => {
      if (holdSpent || !isWatchPage() || !insidePlayer(event.target)) {
        return;
      }
      holdPending = event.target;
      runHold();
    },
    { capture: true }
  );

  for (const name of ["pointerdown", "keydown"]) {
    document.addEventListener(
      name,
      (event) => {
        if (event.isTrusted && (name === "keydown" || insidePlayer(event.target))) {
          playerTouched = true;
        }
      },
      { capture: true, passive: true }
    );
  }

  storageGet({ holdPaused: true })
    .then(({ holdPaused }) => {
      holdWanted = holdPaused !== false;
      holdLoaded = true;
      runHold();
    })
    .catch((error) => console.warn(error.message));

  document.addEventListener("yt-navigate-finish", () => {
    armHold();
    setTimeout(scheduleApply, 400);
  });
  document.addEventListener("yt-page-data-updated", scheduleApply);
  window.addEventListener("load", scheduleApply, { once: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      message?.type !== "riah-youtube-controls-apply" &&
      message?.type !== "riah-youtube-controls-apply"
    ) {
      return;
    }

    storageGet({ holdPaused: true })
      .then(({ holdPaused }) => {
        holdWanted = holdPaused !== false;
        return applyPreferredState();
      })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  scheduleApply();
})();
