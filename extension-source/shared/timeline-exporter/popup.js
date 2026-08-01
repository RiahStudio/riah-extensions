let pollTimer = null;

function queryActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(tabs[0] || null);
    });
  });
}

function sendToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

function sendRuntime(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(response);
    });
  });
}

async function refresh(tabId) {
  const state = await sendToTab(tabId, { type: "riah-timeline-exporter-status" });
  document.getElementById("status").textContent = state.running
    ? `Scrolling... ${state.totalScrolls} passes`
    : "Idle";
  document.getElementById("count").textContent = `${state.count} tweets collected`;
}

async function main() {
  const messageNode = document.getElementById("message");
  const includeRepliesNode = document.getElementById("includeReplies");
  const tab = await queryActiveTab();

  if (!tab?.id || !/https:\/\/(www\.)?(x|twitter)\.com/i.test(tab.url || "")) {
    messageNode.textContent = "Open an X or Twitter page first.";
    return;
  }

  const settings = await sendRuntime({ type: "riah-timeline-exporter-load-settings" });
  includeRepliesNode.checked = !!settings.includeReplies;
  await refresh(tab.id);

  includeRepliesNode.addEventListener("change", () => {
    sendRuntime({
      type: "riah-timeline-exporter-save-settings",
      includeReplies: includeRepliesNode.checked
    }).catch((error) => {
      messageNode.textContent = error.message;
    });
  });

  document.getElementById("start").addEventListener("click", async () => {
    try {
      await sendToTab(tab.id, {
        type: "riah-timeline-exporter-start",
        includeReplies: includeRepliesNode.checked
      });
      await refresh(tab.id);
    } catch (error) {
      messageNode.textContent = error.message;
    }
  });

  document.getElementById("stop").addEventListener("click", async () => {
    try {
      await sendToTab(tab.id, { type: "riah-timeline-exporter-stop" });
      await refresh(tab.id);
    } catch (error) {
      messageNode.textContent = error.message;
    }
  });

  document.getElementById("download").addEventListener("click", async () => {
    try {
      const response = await sendToTab(tab.id, { type: "riah-timeline-exporter-download" });
      messageNode.textContent = response?.ok ? "CSV download started." : response?.error || "Download failed.";
      await refresh(tab.id);
    } catch (error) {
      messageNode.textContent = error.message;
    }
  });

  pollTimer = setInterval(() => {
    refresh(tab.id).catch(() => {
      clearInterval(pollTimer);
    });
  }, 1200);
}

window.addEventListener("unload", () => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
});

main().catch((error) => {
  document.getElementById("message").textContent = error.message;
});
