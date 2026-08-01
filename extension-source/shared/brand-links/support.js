(function () {
  const links = [
    { label: "Riah Studio", href: "https://riahstudio.com/" },
    { label: "Buy me a coffee", href: "https://buymeacoffee.com/riahstudio" }
  ];

  function appendSupportLinks() {
    if (document.querySelector(".riah-support")) {
      return;
    }

    const footer = document.createElement("footer");
    footer.className = "riah-support";
    footer.setAttribute("aria-label", "Riah support links");

    links.forEach((link, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "riah-support__separator";
        separator.setAttribute("aria-hidden", "true");
        separator.textContent = "/";
        footer.appendChild(separator);
      }

      const anchor = document.createElement("a");
      anchor.href = link.href;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      anchor.textContent = link.label;
      footer.appendChild(anchor);
    });

    const target = document.querySelector("main") || document.body;
    target.appendChild(footer);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", appendSupportLinks, { once: true });
  } else {
    appendSupportLinks();
  }
})();
