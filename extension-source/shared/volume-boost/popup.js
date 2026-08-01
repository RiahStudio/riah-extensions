(function () {
  const slider = document.getElementById("gainSlider");
  const value = document.getElementById("volumeValue");
  const tabLabel = document.getElementById("tabLabel");
  const warning = document.getElementById("warning");
  const status = document.getElementById("status");
  const resetButton = document.getElementById("resetButton");
  const buttons = Array.from(document.querySelectorAll("[data-percent]"));
  let pendingTimer = 0;

  function extensionApi() {
    return globalThis.chrome && chrome.runtime ? chrome : null;
  }

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      const api = extensionApi();
      if (!api || !api.runtime || !api.runtime.sendMessage) {
        reject(new Error("Extension runtime is unavailable."));
        return;
      }

      try {
        api.runtime.sendMessage(message, (response) => {
          const error = api.runtime.lastError && api.runtime.lastError.message;
          if (error) {
            reject(new Error(error));
            return;
          }
          if (response && response.ok === false) {
            reject(new Error(response.error || "Riah Volume Boost failed."));
            return;
          }
          resolve(response || { ok: true });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function clampPercent(percent) {
    const numeric = Number(percent);
    if (!Number.isFinite(numeric)) {
      return 100;
    }
    return Math.min(600, Math.max(0, Math.round(numeric / 10) * 10));
  }

  function hostLabel(url) {
    try {
      return new URL(url).hostname || "Current tab";
    } catch {
      return "Current tab";
    }
  }

  function setEnabled(enabled) {
    slider.disabled = !enabled;
    resetButton.disabled = !enabled;
    for (const button of buttons) {
      button.disabled = !enabled;
    }
  }

  function setStatus(text, isError) {
    status.textContent = text;
    status.classList.toggle("is-error", Boolean(isError));
  }

  function renderPercent(percent) {
    const clamped = clampPercent(percent);
    slider.value = String(clamped);
    value.textContent = `${clamped}%`;
    warning.hidden = clamped <= 200;
  }

  function applyPercent(percent) {
    const clamped = clampPercent(percent);
    renderPercent(clamped);
    setStatus(clamped === 100 ? "Normal tab audio." : "Applying...");

    return sendMessage({
      type: "riah-volume-boost-set",
      gain: clamped / 100
    })
      .then((response) => {
        renderPercent(response.percent == null ? clamped : response.percent);
        setStatus(response.active ? "Boost active on this tab." : "Normal tab audio.");
      })
      .catch((error) => {
        setStatus(error.message || String(error), true);
      });
  }

  function scheduleApply(percent) {
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      applyPercent(percent);
    }, 120);
  }

  function loadStatus() {
    setEnabled(false);
    setStatus("Checking tab audio...");
    sendMessage({ type: "riah-volume-boost-status" })
      .then((response) => {
        tabLabel.textContent = hostLabel(response.tabUrl);
        renderPercent(response.percent == null ? 100 : response.percent);
        if (!response.supported) {
          setEnabled(false);
          setStatus("Chromium/Brave tab audio capture is required.", true);
          return;
        }
        setEnabled(true);
        setStatus(response.active ? "Boost active on this tab." : "Normal tab audio.");
      })
      .catch((error) => {
        renderPercent(100);
        setEnabled(false);
        setStatus(error.message || "Chromium/Brave tab audio capture is required.", true);
      });
  }

  slider.addEventListener("input", () => {
    renderPercent(slider.value);
    scheduleApply(slider.value);
  });

  slider.addEventListener("change", () => {
    clearTimeout(pendingTimer);
    applyPercent(slider.value);
  });

  for (const button of buttons) {
    button.addEventListener("click", () => {
      clearTimeout(pendingTimer);
      applyPercent(button.dataset.percent);
    });
  }

  resetButton.addEventListener("click", () => {
    clearTimeout(pendingTimer);
    applyPercent(100);
  });

  loadStatus();
})();
