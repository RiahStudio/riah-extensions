(function () {
  const BUTTON_ID = "riah-library-search-button";

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

  function normalizeIsbn(raw) {
    return (raw || "").replace(/[^0-9X]/gi, "");
  }

  function detectBook() {
    const host = window.__RIAH_LIBRARY_LOOKUP_HOST__ || location.hostname;
    if (host.includes("amazon.")) {
      const titleNode = document.querySelector("#productTitle");
      const authorNode =
        document.querySelector(".contributorNameID") ||
        document.querySelector("#bylineInfo a");
      const bullets = document.body.textContent || "";
      const isbnMatch = bullets.match(/ISBN(?:-1[03])?:?\s*([0-9X-]{10,17})/i);
      return {
        titleNode,
        title: titleNode?.textContent?.trim() || "",
        author: authorNode?.textContent?.trim() || "",
        isbn: normalizeIsbn(isbnMatch?.[1] || "")
      };
    }

    if (host.includes("goodreads.com")) {
      const titleNode =
        document.querySelector("h1.Text__title1") ||
        document.querySelector("[data-testid='bookTitle']");
      const authorNode =
        document.querySelector("[data-testid='name']") ||
        document.querySelector(".ContributorLink__name");
      const isbnMatch = (document.body.textContent || "").match(/ISBN(?:-1[03])?:?\s*([0-9X-]{10,17})/i);
      return {
        titleNode,
        title: titleNode?.textContent?.trim() || "",
        author: authorNode?.textContent?.trim() || "",
        isbn: normalizeIsbn(isbnMatch?.[1] || "")
      };
    }

    if (host.includes("google.com")) {
      const titleNode = document.querySelector("h1");
      const authorNode = document.querySelector(".y8Jpof");
      return {
        titleNode,
        title: titleNode?.textContent?.trim() || "",
        author: authorNode?.textContent?.trim() || "",
        isbn: ""
      };
    }

    return null;
  }

  function fillTemplate(template, details) {
    return template.replace(/\{(title|author|isbn)\}/g, (_, key) =>
      encodeURIComponent(details[key] || "")
    );
  }

  function safeLookupUrl(template, details) {
    try {
      const url = new URL(fillTemplate(template, details));
      return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch (error) {
      return null;
    }
  }

  async function inject() {
    const { searchTemplate = "" } = await storageGet({ searchTemplate: "" });
    if (!searchTemplate || document.getElementById(BUTTON_ID)) {
      return;
    }

    const details = detectBook();
    if (!details?.titleNode || !details.title) {
      return;
    }

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Search my library";
    button.style.cssText =
      "margin-top:12px;padding:10px 14px;border:none;border-radius:999px;" +
      "background:#1f2430;color:#fff;font:600 14px/1.2 'Segoe UI',Tahoma,sans-serif;cursor:pointer;";
    button.addEventListener("click", () => {
      const url = safeLookupUrl(searchTemplate, details);
      if (url) {
        window.open(url, "_blank", "noopener");
      }
    });

    details.titleNode.insertAdjacentElement("afterend", button);
  }

  inject().catch((error) => console.warn(error.message));

  let attempts = 0;
  const interval = setInterval(() => {
    attempts += 1;
    inject().catch((error) => console.warn(error.message));
    if (attempts >= 10 || document.getElementById(BUTTON_ID)) {
      clearInterval(interval);
    }
  }, 1000);
})();
