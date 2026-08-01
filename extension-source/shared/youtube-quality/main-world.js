(function () {
  if (window.__riahYoutubeAutoQualityInstalled) {
    return;
  }
  window.__riahYoutubeAutoQualityInstalled = true;

  const rank = ["hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];
  const ceilings = {
    auto: "hd2160",
    "2160p": "hd2160",
    "1440p": "hd1440",
    "1080p": "hd1080",
    "720p": "hd720",
    "480p": "large",
    "360p": "medium",
    "240p": "small"
  };
  const state = { preferred: "auto" };
  let applyTimer = null;

  function isWatchPage() {
    return location.pathname === "/watch";
  }

  function pickQuality(levels) {
    const ordered = Array.isArray(levels) ? levels.filter(Boolean) : [];
    if (!ordered.length) {
      return null;
    }

    const ceiling = ceilings[state.preferred] || ceilings.auto;
    const ceilingRank = rank.indexOf(ceiling);
    for (const level of ordered) {
      const index = rank.indexOf(level);
      if (index !== -1 && index >= ceilingRank) {
        return level;
      }
    }

    return ordered[ordered.length - 1];
  }

  function setQuality() {
    const player = document.querySelector("#movie_player");
    if (!player) {
      return false;
    }

    const levels =
      player.getAvailableQualityLevels?.() ||
      player.getAvailableQualityLabels?.() ||
      [];
    const target = pickQuality(levels);
    if (!target) {
      return false;
    }

    player.setPlaybackQualityRange?.(target, target);
    player.setPlaybackQuality?.(target);
    return true;
  }

  function scheduleApply() {
    if (applyTimer) {
      clearInterval(applyTimer);
      applyTimer = null;
    }

    if (!isWatchPage()) {
      return;
    }

    let attempts = 0;
    applyTimer = setInterval(() => {
      attempts += 1;
      if (setQuality() || attempts > 20) {
        clearInterval(applyTimer);
        applyTimer = null;
      }
    }, 500);
  }

  document.addEventListener("yt-navigate-finish", () => {
    setTimeout(scheduleApply, 400);
  });

  document.addEventListener("riah-youtube-quality-set", (event) => {
    state.preferred = event.detail?.preferred || "auto";
    scheduleApply();
  });

  scheduleApply();
})();
