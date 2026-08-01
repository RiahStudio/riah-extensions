(function () {
  const GENERIC_BANNER_SELECTOR = [
    "[id*='cookie' i]",
    "[class*='cookie' i]",
    "[id*='consent' i]",
    "[class*='consent' i]",
    "[id*='gdpr' i]",
    "[class*='gdpr' i]",
    "[aria-label*='cookie' i]",
    "[aria-label*='consent' i]"
  ].join(", ");
  const BUTTON_SELECTOR = "button, [role='button'], input[type='button'], input[type='submit'], a";
  // Word-boundary anchored. Unanchored alternatives were the original bug:
  // bare /ok/ matches "Bo-ok-mark", "Gr-ok" and "C-ok-ie", so this clicked
  // X's Bookmark and Grok buttons on every scan. \bok\b matches none of them.
  const REJECT_TEXT =
    /\b(reject|decline|deny|refuse|necessary only|essential only|use necessary|continue without accepting|alle ablehnen|tout refuser|afvis|afwijzen|nur notwendige)\b/i;
  const DISMISS_TEXT =
    /\b(close|dismiss|continue|save choices|confirm choices|hide|ok|okay|understood|got it)\b/i;
  const ACCEPT_TEXT =
    /\b(accept|agree|allow all|accept all|allow cookies|i understand|got it)\b/i;
  // Consent buttons carry short labels. Anything longer is prose that merely
  // happens to contain one of the words above.
  const MAX_LABEL_LENGTH = 40;
  const CONSENT_CONTEXT_TEXT =
    /(cookie|cookies|consent|privacy|gdpr|tracking|preferences|preference|datenschutz|confidentialit|confidentialite)/i;
  // Consent banners appear within seconds of load. Scanning past that window
  // just leaves a clicker loose on a live page.
  const SCAN_WINDOW_MS = 15000;
  const clicked = new WeakSet();
  let scheduled = false;
  let observer = null;
  let stopped = false;

  function stop() {
    stopped = true;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

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

  function visible(element) {
    if (!element || clicked.has(element)) {
      return false;
    }
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function normalizeText(element) {
    if (!element) {
      return "";
    }
    const source =
      element.innerText ||
      element.textContent ||
      element.value ||
      element.getAttribute("aria-label") ||
      element.title ||
      "";
    return source.replace(/\s+/g, " ").trim();
  }

  function isSafeActionTarget(element) {
    if (!element || !visible(element)) {
      return false;
    }

    if (element.tagName !== "A") {
      return true;
    }

    const role = (element.getAttribute("role") || "").toLowerCase();
    if (role === "button") {
      return true;
    }

    const href = (element.getAttribute("href") || "").trim();
    if (!href || href === "#" || href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) {
      return true;
    }

    try {
      const target = new URL(href, location.href);
      return target.origin === location.origin && target.pathname === location.pathname && !!target.hash;
    } catch (error) {
      return false;
    }
  }

  function firstVisible(selectors, root, predicate = () => true) {
    for (const selector of selectors || []) {
      const elements = (root || document).querySelectorAll(selector);
      for (const element of elements) {
        if (visible(element) && predicate(element)) {
          return element;
        }
      }
    }
    return null;
  }

  function findGenericButton(root, matcher) {
    const elements = (root || document).querySelectorAll(BUTTON_SELECTOR);
    for (const element of elements) {
      if (!visible(element)) {
        continue;
      }
      if (!isSafeActionTarget(element)) {
        continue;
      }
      const label = normalizeText(element);
      if (!label || label.length > MAX_LABEL_LENGTH) {
        continue;
      }
      if (matcher.test(label)) {
        return element;
      }
    }
    return null;
  }

  function findBanner(rule) {
    return firstVisible(rule?.bannerSelectors || [], document);
  }

  function hideBanner(element) {
    if (!element) {
      return false;
    }
    element.style.setProperty("display", "none", "important");
    element.style.setProperty("visibility", "hidden", "important");
    document.documentElement.style.removeProperty("overflow");
    document.body?.style?.removeProperty("overflow");
    return true;
  }

  function looksLikeBanner(element) {
    if (!visible(element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const role = (element.getAttribute("role") || "").toLowerCase();
    const label = element.getAttribute("aria-label") || "";
    const context = `${normalizeText(element)} ${element.id || ""} ${element.className || ""} ${label}`;
    const hasConsentContext = CONSENT_CONTEXT_TEXT.test(context);
    const hasAction = Array.from(element.querySelectorAll(BUTTON_SELECTOR)).some((candidate) =>
      isSafeActionTarget(candidate)
    );
    const fixedLike =
      style.position === "fixed" ||
      style.position === "sticky" ||
      role === "dialog" ||
      role === "alertdialog" ||
      element.getAttribute("aria-modal") === "true";
    const bottomBanner =
      rect.height >= 50 &&
      rect.width >= Math.min(window.innerWidth - 24, 280) &&
      rect.bottom >= window.innerHeight - 48;
    const modalSized =
      rect.height >= 80 &&
      rect.width >= Math.min(window.innerWidth - 24, 320);

    return hasConsentContext && hasAction && (fixedLike || bottomBanner || modalSized);
  }

  function actOnRule(rule, mode) {
    const banner = findBanner(rule);
    // Curated per-site selectors may run page-wide. Generic TEXT matching may
    // NOT: with no banner to scope it, it will click any "close"/"ok"/"continue"
    // control anywhere on the page. Only text-match inside a real banner.
    const ruleRoot = banner || document;
    const textRoot = banner;
    let button = null;

    if (mode === "accept") {
      button =
        firstVisible(rule.acceptSelectors, ruleRoot, isSafeActionTarget) ||
        (textRoot && findGenericButton(textRoot, ACCEPT_TEXT));
    } else if (mode === "dismiss") {
      button =
        firstVisible(rule.dismissSelectors, ruleRoot, isSafeActionTarget) ||
        (textRoot && findGenericButton(textRoot, DISMISS_TEXT));
    } else {
      button =
        firstVisible(rule.rejectSelectors, ruleRoot, isSafeActionTarget) ||
        (textRoot && findGenericButton(textRoot, REJECT_TEXT)) ||
        firstVisible(rule.dismissSelectors, ruleRoot, isSafeActionTarget) ||
        (textRoot && findGenericButton(textRoot, DISMISS_TEXT));
    }

    if (button) {
      clicked.add(button);
      button.click();
      return true;
    }

    if (mode !== "accept" && banner) {
      return hideBanner(banner);
    }

    return false;
  }

  function genericFallback(mode) {
    const banners = Array.from(document.querySelectorAll(GENERIC_BANNER_SELECTOR)).filter(looksLikeBanner);
    for (const banner of banners) {
      let button = null;
      if (mode === "accept") {
        button = findGenericButton(banner, ACCEPT_TEXT);
      } else if (mode === "dismiss") {
        button = findGenericButton(banner, DISMISS_TEXT);
      } else {
        button = findGenericButton(banner, REJECT_TEXT) || findGenericButton(banner, DISMISS_TEXT);
      }

      if (button) {
        clicked.add(button);
        button.click();
        return true;
      }

      if (mode !== "accept") {
        hideBanner(banner);
        return true;
      }
    }
    return false;
  }

  function scheduleScan(mode) {
    if (scheduled || stopped) {
      return;
    }
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      if (stopped) {
        return;
      }
      // One banner per page. Once it's handled, stand down for good.
      for (const rule of window.RIAH_COOKIE_RULES || []) {
        if (actOnRule(rule, mode)) {
          stop();
          return;
        }
      }
      if (genericFallback(mode)) {
        stop();
      }
    }, 150);
  }

  storageGet({ defaultMode: "reject", siteModes: {} })
    .then(({ defaultMode, siteModes }) => {
      const host = location.hostname;
      const mode = siteModes[host] || defaultMode || "reject";
      if (mode === "disabled") {
        return;
      }
      scheduleScan(mode);
      document.addEventListener("DOMContentLoaded", () => scheduleScan(mode), { once: true });
      window.addEventListener("load", () => scheduleScan(mode), { once: true });

      // childList only: attribute churn on a live app re-fires this endlessly.
      observer = new MutationObserver(() => scheduleScan(mode));
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true
      });

      setTimeout(() => scheduleScan(mode), 500);
      setTimeout(() => scheduleScan(mode), 1200);
      // Hard stop: past the load window there is no banner left to catch, only risk.
      setTimeout(stop, SCAN_WINDOW_MS);
    })
    .catch((error) => console.warn(error.message));
})();
