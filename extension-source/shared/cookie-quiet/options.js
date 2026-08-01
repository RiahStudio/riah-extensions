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

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function parseOverrides(text) {
  const siteModes = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const [host, mode] = trimmed.split("=");
    const normalizedHost = (host || "").trim();
    const normalizedMode = (mode || "").trim();
    if (!normalizedHost || !["accept", "reject", "dismiss", "disabled"].includes(normalizedMode)) {
      continue;
    }
    siteModes[normalizedHost] = normalizedMode;
  }
  return siteModes;
}

async function main() {
  const form = document.getElementById("form");
  const overridesNode = document.getElementById("overrides");
  const statusNode = document.getElementById("status");
  const modeNodes = Array.from(document.querySelectorAll("input[name='defaultMode']"));
  const settings = await storageGet({ defaultMode: "reject", siteModes: {} });

  const selected = modeNodes.find((node) => node.value === settings.defaultMode) || modeNodes[0];
  selected.checked = true;
  overridesNode.value = Object.entries(settings.siteModes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([host, mode]) => `${host}=${mode}`)
    .join("\n");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const defaultMode = modeNodes.find((node) => node.checked)?.value || "reject";
    const siteModes = parseOverrides(overridesNode.value);
    await storageSet({ defaultMode, siteModes });
    statusNode.textContent = "Saved.";
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
