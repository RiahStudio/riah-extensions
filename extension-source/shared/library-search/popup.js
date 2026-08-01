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

function fillTemplate(template, details) {
  return template.replace(/\{(title|author|isbn)\}/g, (_, key) =>
    encodeURIComponent(details[key] || "")
  );
}

async function main() {
  const queryNode = document.getElementById("query");
  const statusNode = document.getElementById("status");
  const searchButton = document.getElementById("search");
  const { searchTemplate = "" } = await storageGet({ searchTemplate: "" });

  if (!searchTemplate) {
    statusNode.textContent = "Add a library URL template in settings first.";
  }

  searchButton.addEventListener("click", () => {
    if (!searchTemplate) {
      statusNode.textContent = "No template configured yet.";
      return;
    }

    const query = queryNode.value.trim();
    if (!query) {
      statusNode.textContent = "Enter a title or author.";
      return;
    }

    const url = fillTemplate(searchTemplate, {
      title: query,
      author: "",
      isbn: ""
    });
    window.open(url, "_blank", "noopener");
  });
}

main().catch((error) => {
  document.getElementById("status").textContent = error.message;
});
