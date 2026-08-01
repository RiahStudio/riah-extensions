(function () {
  // Same bypass as main-world.js. The style used to live there, so YouTube has
  // never received it; keep it that way rather than quietly changing what
  // YouTube's player gets.
  const host = location.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    return;
  }

  const STYLE_ID = "riah-right-click-restorer-style";
  const STYLE_TEXT = `
      * {
        user-select: auto !important;
        -webkit-user-select: auto !important;
        -moz-user-select: auto !important;
      }
      img {
        -webkit-user-drag: auto !important;
        user-drag: auto !important;
      }
    `;

  // This runs in the isolated content-script world, which is exempt from the
  // page's Content-Security-Policy. Injecting the same <style> from the main
  // world was blocked outright on CSP-strict sites such as Gumroad and Stripe,
  // so selection and image drag were never actually restored there.
  function injectStyle() {
    const root = document.head || document.documentElement;
    if (!root || document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_TEXT;
    root.appendChild(style);
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }

  function apply(enabled) {
    if (!enabled) {
      removeStyle();
      return;
    }

    injectStyle();
    // At document_start there may be no <head> yet, so try again once the
    // parser has built one.
    document.addEventListener("DOMContentLoaded", injectStyle, { once: true });
  }

  chrome.storage.sync.get({ disabledHosts: [] }, ({ disabledHosts }) => {
    const enabled = !Array.isArray(disabledHosts) || !disabledHosts.includes(location.hostname);
    apply(enabled);
    document.dispatchEvent(
      new CustomEvent("riah-right-click-restorer-config", {
        detail: { enabled }
      })
    );
  });
})();
