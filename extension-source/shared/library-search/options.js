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

function validateTemplate(value) {
  const template = value.trim();
  if (!template) {
    return "";
  }
  const sample = template.replace(/\{(title|author|isbn)\}/g, "example");
  const url = new URL(sample);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The library URL must start with http:// or https://.");
  }
  return template;
}

async function main() {
  const form = document.getElementById("form");
  const templateNode = document.getElementById("searchTemplate");
  const statusNode = document.getElementById("status");
  const { searchTemplate = "" } = await storageGet({ searchTemplate: "" });
  templateNode.value = searchTemplate;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const searchTemplate = validateTemplate(templateNode.value);
      await storageSet({ searchTemplate });
      statusNode.textContent = "Saved.";
    } catch (error) {
      statusNode.textContent = error.message;
    }
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
