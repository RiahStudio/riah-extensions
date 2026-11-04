(function () {
  const host = location.hostname.toLowerCase();
  if (host === "youtube.com" || host.endsWith(".youtube.com")) {
    return;
  }
  if (typeof isRiahQuietHost === "function" && isRiahQuietHost(host)) {
    return;
  }

  if (!window.__riahPageUnblock || typeof window.__riahPageUnblock.install !== "function") {
    return;
  }

  window.__riahPageUnblock.install("right-click-restorer");

  document.addEventListener("riah-right-click-restorer-config", (event) => {
    window.__riahPageUnblock.setEnabled(
      "right-click-restorer",
      event.detail?.enabled !== false
    );
  });
})();
