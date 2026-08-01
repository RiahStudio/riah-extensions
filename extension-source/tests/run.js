const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { execFileSync, spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SHARED = path.join(ROOT, "shared");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

let nextDebugPort = 9450;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs = 15000, intervalMs = 200) {
  const start = Date.now();
  let lastError = null;

  while (Date.now() - start < timeoutMs) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await delay(intervalMs);
    }
  }

  throw lastError || new Error("Timed out while waiting for condition.");
}

function sortStrings(values) {
  return [...values].sort();
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function json(filePath) {
  return JSON.parse(read(filePath));
}

function manifestSummary(extensionName) {
  // A Firefox-only extension has no Chromium manifest, so summarise whichever
  // one it actually ships.
  const chromePath = path.join(SHARED, extensionName, "manifest.chrome.json");
  const manifest = json(
    fs.existsSync(chromePath)
      ? chromePath
      : path.join(SHARED, extensionName, "manifest.firefox.json")
  );
  return {
    name: manifest.name,
    defaultTitle: manifest.action?.default_title || "",
    homepageUrl: manifest.homepage_url || "",
    permissions: sortStrings(manifest.permissions || []),
    hostPermissions: sortStrings(manifest.host_permissions || []),
    matches: sortStrings(
      (manifest.content_scripts || []).flatMap((entry) => entry.matches || [])
    )
  };
}

function createEventHook() {
  const listeners = [];
  return {
    listeners,
    addListener(listener) {
      listeners.push(listener);
    }
  };
}

function createStorageArea(initialValue) {
  const state = { ...initialValue };
  return {
    state,
    get(defaults, callback) {
      if (typeof defaults === "string") {
        callback({ [defaults]: state[defaults] });
        return;
      }

      const result = Array.isArray(defaults) ? {} : { ...defaults };
      if (Array.isArray(defaults)) {
        for (const key of defaults) {
          result[key] = state[key];
        }
      }
      for (const [key, value] of Object.entries(state)) {
        result[key] = value;
      }
      callback(result);
    },
    set(value, callback) {
      Object.assign(state, value);
      if (callback) {
        callback();
      }
    }
  };
}

function loadBackgroundScript(filePath, chrome) {
  const context = vm.createContext({
    chrome,
    console,
    Map,
    URL,
    setTimeout,
    clearTimeout,
    Promise
  });
  const script = new vm.Script(read(filePath), { filename: filePath });
  script.runInContext(context);
}

async function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    async send(method, params = {}) {
      const id = ++nextId;
      const result = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return result;
    },
    close() {
      socket.close();
    }
  };
}

async function rmrfWithRetry(targetPath) {
  const maxAttempts = 30;
  let lastError = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) {
        break;
      }
      await delay(1000);
    }
  }

  if (lastError && ["EBUSY", "ENOTEMPTY", "EPERM"].includes(lastError.code)) {
    console.warn(`Skipped locked browser profile cleanup: ${targetPath}`);
    return;
  }

  throw lastError || new Error(`Unable to remove ${targetPath}`);
}

async function startEdge(extensionPath) {
  const debugPort = nextDebugPort++;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "riah-edge-"));
  const args = [
    "--headless=new",
    "--no-startup-window",
    "--remote-debugging-port=" + debugPort,
    "--user-data-dir=" + profileDir,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=msEdgeSync",
    "--disable-background-networking",
    "--disable-sync",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-breakpad",
    "--disable-crash-reporter"
  ];

  if (extensionPath) {
    args.push("--disable-extensions-except=" + extensionPath);
    args.push("--load-extension=" + extensionPath);
  }

  const child = spawn(EDGE, args, { stdio: "ignore" });
  const version = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
    if (!response.ok) {
      throw new Error("DevTools version endpoint not ready.");
    }
    return response.json();
  });
  const browser = await connectCdp(version.webSocketDebuggerUrl);

  return {
    async newPage() {
      const { targetId } = await browser.send("Target.createTarget", {
        url: "about:blank"
      });
      const target = await waitFor(async () => {
        const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
        const list = await response.json();
        const found = list.find((item) => item.id === targetId);
        if (!found) {
          throw new Error("Target not ready.");
        }
        return found;
      });
      const page = await connectCdp(target.webSocketDebuggerUrl);
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      return page;
    },
    async close() {
      browser.close();
      try {
        execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
          stdio: "ignore"
        });
      } catch (error) {
        void error;
      }
      await delay(500);
      await rmrfWithRetry(profileDir);
    }
  };
}

async function evaluate(page, expression, awaitPromise = false) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Evaluation failed.");
  }
  return result.result.value;
}

async function injectRuntimeSource(page, source) {
  await page.send("Runtime.evaluate", {
    expression: source
  });
}

async function navigate(page, url, waitMs = 1200) {
  await page.send("Page.navigate", { url });
  await delay(waitMs);
}

function createFixtureServer(routes) {
  const server = http.createServer((request, response) => {
    const route = routes[request.url];
    if (!route) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
      return;
    }

    const headers = {
      "content-type": route.contentType || "text/html; charset=utf-8",
      ...(route.headers || {})
    };
    response.writeHead(200, headers);
    response.end(route.body);
  });

  return {
    async start() {
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      return `http://127.0.0.1:${port}`;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

function buildInjectedSource({ storageSync = {}, storageLocal = {}, extra = "", files }) {
  const stub = `
    window.__riahTest = {
      storageSync: ${JSON.stringify(storageSync)},
      storageLocal: ${JSON.stringify(storageLocal)},
      runtimeMessages: [],
      openedUrls: [],
      listeners: []
    };
    window.chrome = {
      runtime: {
        lastError: null,
        onMessage: {
          addListener(fn) { window.__riahTest.listeners.push(fn); }
        },
        sendMessage(message, callback) {
          window.__riahTest.runtimeMessages.push(message);
          if (callback) {
            callback({ ok: true });
          }
        },
        openOptionsPage() {
          window.__riahTest.openedOptions = true;
        },
        getURL(value) {
          return value;
        }
      },
      storage: {
        sync: {
          get(defaults, callback) {
            callback(Object.assign({}, defaults, window.__riahTest.storageSync));
          },
          set(value, callback) {
            Object.assign(window.__riahTest.storageSync, value);
            if (callback) {
              callback();
            }
          }
        },
        local: {
          get(defaults, callback) {
            callback(Object.assign({}, defaults, window.__riahTest.storageLocal));
          },
          set(value, callback) {
            Object.assign(window.__riahTest.storageLocal, value);
            if (callback) {
              callback();
            }
          }
        }
      },
      tabs: {
        query(queryInfo, callback) {
          callback([]);
        },
        reload(tabId, callback) {
          if (callback) {
            callback();
          }
        },
        sendMessage(tabId, message, callback) {
          const listener = window.__riahTest.listeners[0];
          if (!listener) {
            if (callback) {
              callback();
            }
            return;
          }
          const maybeAsync = listener(message, null, (response) => {
            if (callback) {
              callback(response);
            }
          });
          if (maybeAsync !== true && maybeAsync !== undefined && callback) {
            callback(maybeAsync);
          }
        }
      }
    };
    window.__riahInvokeMessage = function(message) {
      return new Promise((resolve) => {
        const listener = window.__riahTest.listeners[0];
        if (!listener) {
          resolve(null);
          return;
        }
        const maybeAsync = listener(message, null, resolve);
        if (maybeAsync !== true && maybeAsync !== undefined) {
          resolve(maybeAsync);
        }
      });
    };
    window.open = function(url) {
      window.__riahTest.openedUrls.push(url);
      return null;
    };
  `;

  return [stub, extra, ...files.map((filePath) => read(filePath))].join("\n");
}

async function runStaticAudit() {
  const expected = {
    "right-click-restorer": {
      permissions: ["activeTab", "storage"],
      hostPermissions: [],
      matches: ["<all_urls>", "<all_urls>"]
    },
    "autoplay-guard": {
      permissions: ["activeTab", "storage"],
      hostPermissions: [],
      matches: ["<all_urls>", "<all_urls>"]
    },
    "volume-boost": {
      permissions: ["activeTab", "offscreen", "storage", "tabCapture", "tabs"],
      hostPermissions: [],
      matches: [],
      chromiumOnly: true
    },
    "thai-year-helper": {
      permissions: ["activeTab", "storage"],
      hostPermissions: [],
      matches: [
        "https://google.co.th/*",
        "https://google.com/*",
        "https://www.google.co.th/*",
        "https://www.google.com/*"
      ]
    },
    "cookie-quiet": {
      permissions: ["storage"],
      hostPermissions: ["<all_urls>"],
      matches: ["<all_urls>"],
      chromiumOnly: true
    },
    "tab-sleeper": {
      permissions: ["alarms", "storage", "tabs"],
      hostPermissions: [],
      matches: [],
      firefoxOnly: true
    },
    "tab-anchor": {
      permissions: ["tabs"],
      hostPermissions: [],
      matches: []
    },
    "paste-guard": {
      permissions: [],
      hostPermissions: [],
      matches: ["<all_urls>"]
    },
    "library-search": {
      permissions: ["storage"],
      hostPermissions: [],
      matches: [
        "https://www.amazon.ca/*",
        "https://www.amazon.co.jp/*",
        "https://www.amazon.co.uk/*",
        "https://www.amazon.com.au/*",
        "https://www.amazon.com/*",
        "https://www.amazon.de/*",
        "https://www.amazon.es/*",
        "https://www.amazon.fr/*",
        "https://www.amazon.in/*",
        "https://www.amazon.it/*",
        "https://www.goodreads.com/*",
        "https://www.google.com/books/*"
      ]
    },
    "tenhou-english": {
      permissions: [],
      hostPermissions: [],
      matches: ["https://tenhou.net/4/*"]
    },
    "timeline-exporter": {
      permissions: ["downloads", "storage"],
      hostPermissions: [],
      matches: ["https://*.x.com/*", "https://twitter.com/*", "https://x.com/*"]
    },
    "youtube-quality": {
      permissions: ["storage"],
      hostPermissions: [],
      matches: [
        "https://m.youtube.com/*",
        "https://m.youtube.com/*",
        "https://www.youtube.com/*",
        "https://www.youtube.com/*"
      ]
    },
    "youtube-controls": {
      permissions: ["storage"],
      hostPermissions: [],
      matches: ["https://m.youtube.com/*", "https://www.youtube.com/*"]
    }
  };

  for (const [extensionName, expectation] of Object.entries(expected)) {
    // An extension ships to a browser family only when that family's manifest
    // exists. That is how the build expresses "Firefox already does this
    // natively, so do not ship it there" and vice versa.
    const chromePath = path.join(SHARED, extensionName, "manifest.chrome.json");
    const firefoxManifestPath = path.join(SHARED, extensionName, "manifest.firefox.json");
    assert(
      fs.existsSync(firefoxManifestPath) !== (expectation.chromiumOnly === true),
      expectation.chromiumOnly
        ? `${extensionName} is Chromium-only and should not ship a Firefox manifest.`
        : `${extensionName} should ship a Firefox manifest.`
    );
    assert(
      fs.existsSync(chromePath) !== (expectation.firefoxOnly === true),
      expectation.firefoxOnly
        ? `${extensionName} is Firefox-only and should not ship a Chromium manifest.`
        : `${extensionName} should ship a Chromium manifest.`
    );

    const summary = manifestSummary(extensionName);
    const chromeManifest = expectation.firefoxOnly ? null : json(chromePath);
    const firefoxManifest = expectation.chromiumOnly ? null : json(firefoxManifestPath);
    assert(
      /^Riah\s/.test(summary.name) && !summary.name.startsWith("Riah:"),
      `${extensionName} should use the visible \"Riah ...\" product-name format.`
    );
    assert(
      summary.homepageUrl === "https://riahstudio.com/",
      `${extensionName} should link its manifest homepage to Riah Studio.`
    );
    if (summary.defaultTitle) {
      assert(
        /^Riah\s/.test(summary.defaultTitle),
        `${extensionName} action title should keep the Riah prefix.`
      );
    }
    assert(
      !firefoxManifest || firefoxManifest.name === summary.name,
      `${extensionName} should use the same visible name in Chrome and Firefox.`
    );
    assert(
      !chromeManifest ||
        JSON.stringify(sortStrings(Object.keys(chromeManifest.icons || {}))) ===
          JSON.stringify(["128", "32"]),
      `${extensionName} Chrome manifest should reference the official 32/128 Riah icon exports.`
    );
    assert(
      !firefoxManifest ||
        JSON.stringify(sortStrings(Object.keys(firefoxManifest.icons || {}))) ===
          JSON.stringify(["128", "32"]),
      `${extensionName} Firefox manifest should reference the official 32/128 Riah icon exports.`
    );
    for (const iconFile of ["32.png", "128.png", "512.png", "source.svg"]) {
      assert(
        fs.existsSync(path.join(SHARED, extensionName, "icons", iconFile)),
        `${extensionName} should include ${iconFile} from the Riah icon system.`
      );
    }
    for (const staleIcon of ["16.png", "48.png"]) {
      assert(
        !fs.existsSync(path.join(SHARED, extensionName, "icons", staleIcon)),
        `${extensionName} should not ship old placeholder ${staleIcon}.`
      );
    }
    assert(
      JSON.stringify(summary.permissions) === JSON.stringify(sortStrings(expectation.permissions)),
      `${extensionName} permissions drifted from expected minimum.`
    );
    assert(
      JSON.stringify(summary.hostPermissions) ===
        JSON.stringify(sortStrings(expectation.hostPermissions)),
      `${extensionName} host permissions drifted from expected minimum.`
    );
    assert(
      JSON.stringify(summary.matches) === JSON.stringify(sortStrings(expectation.matches)),
      `${extensionName} content script matches drifted from expected scope.`
    );
  }

  const forbidden = [
    { pattern: /\beval\s*\(/, label: "eval()" },
    { pattern: /\bnew Function\s*\(/, label: "new Function()" },
    { pattern: /\bsetTimeout\s*\(\s*["']/, label: "string-based setTimeout" },
    { pattern: /\bsetInterval\s*\(\s*["']/, label: "string-based setInterval" },
    { pattern: /<script[^>]+src=["']https?:/i, label: "remote script tag" },
    { pattern: /\bscript\.src\s*=\s*["']https?:/i, label: "dynamic remote script" },
    { pattern: /\bimportScripts\s*\(\s*["']https?:/i, label: "remote importScripts" },
    { pattern: /\binnerHTML\s*=/, label: "innerHTML sink" },
    { pattern: /\bouterHTML\s*=/, label: "outerHTML sink" },
    { pattern: /\binsertAdjacentHTML\s*\(/, label: "insertAdjacentHTML sink" }
  ];

  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.(js|html|json)$/i.test(entry.name)) {
        files.push(full);
      }
    }
  }
  walk(SHARED);

  for (const filePath of files) {
    const text = read(filePath);
    for (const rule of forbidden) {
      assert(!rule.pattern.test(text), `${rule.label} found in ${path.relative(ROOT, filePath)}`);
    }
    if (/manifest\.(chrome|firefox)\.json$/i.test(filePath)) {
      const manifest = JSON.parse(text);
      const visibleText = [
        manifest.name,
        manifest.action?.default_title
      ]
        .filter(Boolean)
        .join("\n");
      assert(
        visibleText.split("\n").every((value) => /^Riah\s/.test(value)),
        `${path.relative(ROOT, filePath)} should keep visible names Riah-prefixed.`
      );
    } else if (/(?:popup|options)\.html$/i.test(filePath)) {
      assert(
        /<title>\s*Riah\s/i.test(text),
        `${path.relative(ROOT, filePath)} should keep document titles Riah-prefixed.`
      );
    }
  }

  const uiFiles = files.filter((filePath) => /(?:popup|options)\.html$/i.test(filePath));
  for (const filePath of uiFiles) {
    const text = read(filePath);
    assert(
      text.includes("brand-links/support.css") && text.includes("brand-links/support.js"),
      `${path.relative(ROOT, filePath)} should include the unobtrusive Riah support links.`
    );
  }

  const rightClickMainWorld = read(
    path.join(SHARED, "right-click-restorer", "main-world.js")
  );
  assert(
    rightClickMainWorld.includes('host.endsWith(".youtube.com")') &&
      !rightClickMainWorld.includes('"mousedown"') &&
      !rightClickMainWorld.includes("Event.prototype.preventDefault") &&
      !rightClickMainWorld.includes("pointer-events"),
    "right-click-restorer should bypass YouTube and never intercept ordinary pointer behavior."
  );

  for (const fileName of ["content.js", "main-world.js"]) {
    const autoplaySource = read(path.join(SHARED, "autoplay-guard", fileName));
    assert(
      autoplaySource.includes('host.endsWith(".youtube.com")') &&
        !autoplaySource.includes(".pause("),
      `autoplay-guard ${fileName} should bypass YouTube and never pause existing media.`
    );
  }

  const youtubeAutoplaySource = read(path.join(SHARED, "youtube-controls", "content.js"));
  assert(
    !youtubeAutoplaySource.includes("new MutationObserver"),
    "youtube-controls should avoid a page-wide observer on YouTube's high-churn SPA."
  );

  const volumeManifest = json(path.join(SHARED, "volume-boost", "manifest.chrome.json"));
  assert(
    !volumeManifest.host_permissions,
    "volume-boost should not request broad host permissions."
  );

  const volumeBackground = read(path.join(SHARED, "volume-boost", "background.js"));
  const volumeOffscreen = read(path.join(SHARED, "volume-boost", "offscreen.js"));
  assert(
    volumeBackground.includes("chrome.tabCapture.getMediaStreamId") &&
      volumeBackground.includes("chrome.offscreen.createDocument"),
    "volume-boost should use tabCapture through an offscreen document."
  );
  assert(
    volumeOffscreen.includes('chromeMediaSource: "tab"') &&
      volumeOffscreen.includes("createMediaStreamSource") &&
      volumeOffscreen.includes("createGain"),
    "volume-boost should route captured tab audio through a Web Audio gain node."
  );
}

async function runBackgroundUnitTests() {
  {
    const detached = createEventHook();
    const attached = createEventHook();
    const removed = createEventHook();
    const moved = [];
    const removedWindows = [];
    let queryCount = 0;

    const chrome = {
      runtime: { lastError: null },
      tabs: {
        onDetached: detached,
        onAttached: attached,
        onRemoved: removed,
        move(tabId, options, callback) {
          moved.push({ tabId, options });
          callback({ id: tabId });
        },
        query(queryInfo, callback) {
          queryCount += 1;
          callback(queryCount === 1 ? [{ id: 9 }] : []);
        }
      },
      windows: {
        get(windowId, callback) {
          callback({ id: windowId });
        },
        remove(windowId, callback) {
          removedWindows.push(windowId);
          callback();
        }
      }
    };

    loadBackgroundScript(path.join(SHARED, "tab-anchor", "background.js"), chrome);
    detached.listeners[0](9, { oldWindowId: 1, oldPosition: 3 });
    await attached.listeners[0](9, { newWindowId: 2 });
    assert(
      moved.length === 1 &&
        moved[0].options.windowId === 1 &&
        moved[0].options.index === 3,
      "tab-anchor should move the tab back to its original position."
    );
    assert(
      removedWindows[0] === 2,
      "tab-anchor should close the new empty window after restoring the tab."
    );
  }


}

async function runBrowserSmokeTests() {
  const routes = {
    "/dfwp": {
      body: `<!doctype html><html><body>
        <input id="field">
        <script>
          window.flags = { paste: 0, context: 0, copy: 0 };
          document.onpaste = function(e){ window.flags.paste += 100; e.preventDefault(); };
          document.oncontextmenu = function(e){ window.flags.context += 100; e.preventDefault(); };
          window.addEventListener('paste', function(e){ window.flags.paste += 1; e.preventDefault(); }, true);
          window.addEventListener('contextmenu', function(e){ window.flags.context += 1; e.preventDefault(); }, true);
          window.addEventListener('copy', function(e){ window.flags.copy += 1; e.preventDefault(); }, true);
        </script>
      </body></html>`
    },
    "/arc": {
      body: `<!doctype html><html><head>
        <style>#blocked { user-select: none; -webkit-user-select: none; }</style>
      </head><body>
        <div id="blocked">Blocked text</div>
        <div id="seek" role="slider" tabindex="0" style="display:block;width:400px;height:24px"></div>
        <script>
          window.flags = { context: 0, selectstart: 0, copy: 0, mousedown: 0, seek: 0 };
          window.addEventListener('contextmenu', () => { window.flags.context += 1; }, true);
          window.addEventListener('selectstart', () => { window.flags.selectstart += 1; }, true);
          window.addEventListener('copy', () => { window.flags.copy += 1; }, true);
          const seek = document.getElementById('seek');
          seek.addEventListener('mousedown', () => { window.flags.mousedown += 1; });
          seek.addEventListener('click', () => { window.flags.seek += 1; });
        </script>
      </body></html>`
    },
    "/rightclick-csp": {
      headers: {
        "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'"
      },
      body: `<!doctype html><html><body>
        <p id="blocked" style="user-select:none">Selection is blocked by the page.</p>
      </body></html>`
    },
    "/autoplay-csp": {
      headers: {
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; object-src 'none'"
      },
      body: "<!doctype html><html><body><p>Autoplay test</p></body></html>"
    },
    "/autoplay-existing": {
      body: `<!doctype html><html><body>
        <script>
          window.pauseCalls = 0;
          setTimeout(() => {
            const media = document.createElement('video');
            media.id = 'existing-media';
            Object.defineProperty(media, 'paused', { get: () => false });
            media.pause = () => { window.pauseCalls += 1; };
            document.body.appendChild(media);
          }, 300);
        </script>
      </body></html>`
    },
    "/be": {
      body: `<!doctype html><html><body><div id="root">ปี 2568</div></body></html>`
    },
    "/watch": {
      body: `<!doctype html><html><body>
        <div id="movie_player" class="html5-video-player">
          <button class="ytp-autonav-toggle-button" aria-label="Autoplay is on"></button>
          <div class="ytp-progress-bar" role="slider" tabindex="0"
            aria-label="Seek slider" aria-keyshortcuts="c ArrowLeft ArrowRight"
            style="display:block;width:400px;height:24px;pointer-events:auto"></div>
          <button class="ytp-subtitles-button ytp-button" aria-label="Subtitles/closed captions (c)" aria-pressed="true"></button>
          <video id="player-video"></video>
        </div>
        <script>
          const video = document.getElementById('player-video');
          const realPause = video.pause.bind(video);
          window.pauseCalls = 0;
          video.pause = () => { window.pauseCalls += 1; realPause(); };
          window.firePlay = (seconds) => {
            Object.defineProperty(video, 'currentTime', { value: seconds, configurable: true });
            video.dispatchEvent(new Event('play'));
          };
          const button = document.querySelector('.ytp-autonav-toggle-button');
          const captions = document.querySelector('.ytp-subtitles-button');
          const seekBar = document.querySelector('.ytp-progress-bar');
          window.toggleClicks = 0;
          window.captionClicks = 0;
          window.seekClicks = 0;
          window.seekSeconds = 0;
          button.addEventListener('click', () => {
            window.toggleClicks += 1;
            const next = button.getAttribute('aria-label') === 'Autoplay is on'
              ? 'Autoplay is off'
              : 'Autoplay is on';
            button.setAttribute('aria-label', next);
            button.setAttribute('aria-checked', next.endsWith('on') ? 'true' : 'false');
          });
          captions.addEventListener('click', () => {
            window.captionClicks += 1;
            captions.setAttribute('aria-pressed', 'false');
          });
          seekBar.addEventListener('click', (event) => {
            window.seekClicks += 1;
            const rect = seekBar.getBoundingClientRect();
            window.seekSeconds = Math.round(((event.clientX - rect.left) / rect.width) * 300);
          });
        </script>
      </body></html>`
    },
    "/watch?delayed=1": {
      body: `<!doctype html><html><body>
        <div id="player-root"></div>
        <script>
          window.toggleClicks = 0;
          setTimeout(() => {
            const button = document.createElement('button');
            button.className = 'ytp-autonav-toggle-button';
            button.setAttribute('aria-label', 'Autoplay is on');
            button.addEventListener('click', () => {
              window.toggleClicks += 1;
              const next = button.getAttribute('aria-label') === 'Autoplay is on'
                ? 'Autoplay is off'
                : 'Autoplay is on';
              button.setAttribute('aria-label', next);
              button.setAttribute('aria-checked', next.endsWith('on') ? 'true' : 'false');
            });
            const player = document.createElement('div');
            player.className = 'html5-video-player';
            const captions = document.createElement('button');
            captions.className = 'ytp-subtitles-button ytp-button';
            captions.setAttribute('aria-label', 'Subtitles/closed captions (c)');
            captions.setAttribute('aria-pressed', 'true');
            window.captionClicks = 0;
            captions.addEventListener('click', () => {
              window.captionClicks += 1;
              captions.setAttribute('aria-pressed', 'false');
            });
            player.appendChild(button);
            player.appendChild(captions);
            document.getElementById('player-root').appendChild(player);
          }, 12500);
        </script>
      </body></html>`
    },
    "/watch?quality=1": {
      body: `<!doctype html><html><body>
        <div id="movie_player"></div>
        <script>
          window.qualityCalls = [];
          const player = document.getElementById('movie_player');
          player.getAvailableQualityLevels = () => ['hd2160', 'hd1440', 'hd1080', 'hd720'];
          player.setPlaybackQualityRange = (min, max) => { window.qualityCalls.push({ min, max }); };
          player.setPlaybackQuality = (value) => { window.qualityCalls.push({ value }); };
        </script>
      </body></html>`
    },
    "/tenhou": {
      body: `<!doctype html><html><body>
        <div id="root">対戦 立直 東一局</div>
        <script>
          setTimeout(() => {
            const node = document.createElement('div');
            node.textContent = '流局';
            document.body.appendChild(node);
          }, 200);
        </script>
      </body></html>`
    },
    "/amazon": {
      body: `<!doctype html><html><body>
        <h1 id="productTitle">The Testing Book</h1>
        <div id="bylineInfo"><a>Ada Lovelace</a></div>
        <div id="detailBullets_feature_div">ISBN-13: 978-1234567890</div>
      </body></html>`
    },
    "/x": {
      body: `<!doctype html><html><body>
        <article data-testid="tweet">
          <div data-testid="User-Name">@sampleuser</div>
          <a href="https://x.com/sampleuser/status/111"></a>
          <div data-testid="tweetText">First post</div>
          <time datetime="2026-04-22T00:00:00.000Z"></time>
          <button data-testid="reply" aria-label="3 replies"></button>
          <button data-testid="retweet" aria-label="4 reposts"></button>
          <button data-testid="like" aria-label="5 likes"></button>
        </article>
        <article data-testid="tweet">
          <div data-testid="User-Name">@sampleuser</div>
          <a href="https://x.com/sampleuser/status/222"></a>
          <div data-testid="tweetText">Second post</div>
          <time datetime="2026-04-21T00:00:00.000Z"></time>
          <button data-testid="reply" aria-label="1 reply"></button>
          <button data-testid="retweet" aria-label="2 reposts"></button>
          <button data-testid="like" aria-label="9 likes"></button>
        </article>
        <article data-testid="tweet">
          <div data-testid="User-Name">@sampleuser</div>
          <div dir="ltr">Replying to @friend</div>
          <a href="https://x.com/sampleuser/status/333"></a>
          <div data-testid="tweetText">A reply that should be optional</div>
          <time datetime="2026-04-20T00:00:00.000Z"></time>
          <button data-testid="reply" aria-label="0 replies"></button>
          <button data-testid="retweet" aria-label="0 reposts"></button>
          <button data-testid="like" aria-label="1 like"></button>
        </article>
      </body></html>`
    }
  };

  const server = createFixtureServer(routes);
  const baseUrl = await server.start();

  try {
    {
      const edge = await startEdge(
        path.join(ROOT, "dist", "chrome", "paste-guard")
      );
      try {
        const page = await edge.newPage();
        await navigate(page, `${baseUrl}/dfwp`);
        const flags = JSON.parse(
          await evaluate(
            page,
            `(() => {
              const input = document.getElementById('field');
              const paste = new Event('paste', { bubbles: true, cancelable: true });
              const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
              const copy = new Event('copy', { bubbles: true, cancelable: true });
              const results = {
                pasteAllowed: input.dispatchEvent(paste),
                contextAllowed: input.dispatchEvent(context),
                copyAllowed: input.dispatchEvent(copy),
                flags: window.flags
              };
              return JSON.stringify(results);
            })()`
          )
        );
        assert(
          flags.pasteAllowed === true &&
            flags.contextAllowed === true &&
            flags.copyAllowed === true,
          "paste-guard should keep blocked events from being canceled."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge(
        path.join(ROOT, "dist", "chrome", "right-click-restorer")
      );
      try {
        const page = await edge.newPage();
        await navigate(page, `${baseUrl}/arc`);
        const result = JSON.parse(
          await evaluate(
            page,
            `(() => {
              const blocked = document.getElementById('blocked');
              const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
              const select = new Event('selectstart', { bubbles: true, cancelable: true });
              const copy = new Event('copy', { bubbles: true, cancelable: true });
              const preventDefaultProbe = document.createElement('div');
              preventDefaultProbe.addEventListener('mousedown', (event) => event.preventDefault());
              return JSON.stringify({
                contextAllowed: blocked.dispatchEvent(context),
                selectAllowed: blocked.dispatchEvent(select),
                copyAllowed: blocked.dispatchEvent(copy),
                userSelect: getComputedStyle(blocked).userSelect,
                mousedownCanStillBeCanceled: preventDefaultProbe.dispatchEvent(
                  new MouseEvent('mousedown', { bubbles: true, cancelable: true })
                ),
                seekRect: (() => {
                  const rect = document.getElementById('seek').getBoundingClientRect();
                  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
                })()
              });
            })()`
          )
        );
        assert(
          result.contextAllowed === true &&
            result.selectAllowed === true &&
            result.copyAllowed === true &&
            result.userSelect !== "none" &&
            result.mousedownCanStillBeCanceled === false,
          "right-click-restorer should keep the events uncanceled and restore selection."
        );

        // The style used to be injected from the main world, where the page's
        // CSP blocked it outright and selection was never actually restored.
        const cspPage = await edge.newPage();
        await navigate(cspPage, `${baseUrl}/rightclick-csp`, 1200);
        const cspResult = JSON.parse(
          await evaluate(
            cspPage,
            `JSON.stringify({
              styleInjected: !!document.getElementById('riah-right-click-restorer-style'),
              userSelect: getComputedStyle(document.getElementById('blocked')).userSelect
            })`
          )
        );
        assert(
          cspResult.styleInjected === true && cspResult.userSelect !== "none",
          "right-click-restorer should restore selection on a CSP-locked page, not be blocked by it."
        );
        cspPage.close();
        const seekX = result.seekRect.left + result.seekRect.width * 0.75;
        const seekY = result.seekRect.top + result.seekRect.height / 2;
        await page.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x: seekX,
          y: seekY,
          button: "left",
          clickCount: 1
        });
        await page.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: seekX,
          y: seekY,
          button: "left",
          clickCount: 1
        });
        await delay(100);
        const pointerResult = JSON.parse(
          await evaluate(page, "JSON.stringify(window.flags)")
        );
        assert(
          pointerResult.mousedown === 1 && pointerResult.seek === 1,
          "right-click-restorer should not intercept pointer seeking or clicks."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge(
        path.join(ROOT, "dist", "chrome", "autoplay-guard")
      );
      try {
        const page = await edge.newPage();
        await navigate(page, `${baseUrl}/autoplay-csp`, 1200);
        const result = JSON.parse(
          await evaluate(
            page,
            `(() => {
              const text = String(HTMLMediaElement.prototype.play);
              return JSON.stringify({
                wrapped: text.includes('Autoplay blocked by Riah extension')
              });
            })()`
          )
        );
        const rejection = await evaluate(
          page,
          `(async () => {
            try {
              await document.createElement('video').play();
              return 'resolved';
            } catch (error) {
              return error.name;
            }
          })()`,
          true
        );
        assert(
          result.wrapped && rejection === "NotAllowedError",
          "autoplay-guard should install the main-world wrapper even on a CSP-locked page."
        );
        page.close();

        const existingPage = await edge.newPage();
        await navigate(existingPage, `${baseUrl}/autoplay-existing`, 1200);
        const beforePlay = await evaluate(existingPage, "window.pauseCalls");
        const blockedPlay = await evaluate(
          existingPage,
          `(async () => {
            try {
              await document.getElementById('existing-media').play();
              return 'resolved';
            } catch (error) {
              return error.name;
            }
          })()`,
          true
        );
        const afterPlay = await evaluate(existingPage, "window.pauseCalls");
        assert(
          beforePlay === 0 && blockedPlay === "NotAllowedError" && afterPlay === 0,
          "autoplay-guard should reject new autoplay without pausing existing media."
        );
        existingPage.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          storageSync: {
            disabledHosts: [],
            modeByHost: {}
          },
          files: [path.join(SHARED, "thai-year-helper", "content.js")]
        });
        await navigate(page, `${baseUrl}/be`);
        await injectRuntimeSource(page, source);
        await evaluate(
          page,
          `(() => {
            const later = document.createElement('div');
            later.textContent = 'พ.ศ. 2567';
            document.body.appendChild(later);
          })()`
        );
        await delay(300);
        const bodyText = await evaluate(page, "document.body.innerText");
        assert(
          bodyText.includes("2568 (2025)") && bodyText.includes("2567 (2024)"),
          "thai-year-helper should annotate existing and newly-added BE years."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          storageSync: {
            autoplayEnabled: false,
            captionsOff: true
          },
          files: [path.join(SHARED, "youtube-controls", "content.js")]
        });
        await navigate(page, `${baseUrl}/watch`, 500);
        await injectRuntimeSource(page, source);
        await delay(1500);
        const result = JSON.parse(
          await evaluate(
            page,
            `JSON.stringify({
              clicks: window.toggleClicks,
              label: document.querySelector('.ytp-autonav-toggle-button').getAttribute('aria-label'),
              captionClicks: window.captionClicks,
              captionsPressed: document.querySelector('.ytp-subtitles-button').getAttribute('aria-pressed'),
              seekClicks: window.seekClicks,
              seekStyle: document.querySelector('.ytp-progress-bar').getAttribute('style'),
              seekRect: (() => {
                const rect = document.querySelector('.ytp-progress-bar').getBoundingClientRect();
                return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
              })()
            })`
          )
        );
        assert(
          result.clicks === 1 && result.label === "Autoplay is off",
          "youtube-controls should turn the autoplay toggle off by default."
        );
        assert(
          result.captionClicks === 1 && result.captionsPressed === "false",
          "youtube-controls should turn captions off through only the real CC button."
        );
        assert(
          result.seekClicks === 0 &&
            result.seekStyle === "display:block;width:400px;height:24px;pointer-events:auto",
          "youtube-controls should not click or restyle the YouTube seek bar."
        );

        const seekX = result.seekRect.left + result.seekRect.width * 0.75;
        const seekY = result.seekRect.top + result.seekRect.height / 2;
        await page.send("Input.dispatchMouseEvent", {
          type: "mousePressed",
          x: seekX,
          y: seekY,
          button: "left",
          clickCount: 1
        });
        await page.send("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          x: seekX,
          y: seekY,
          button: "left",
          clickCount: 1
        });
        await delay(100);
        const seekResult = JSON.parse(
          await evaluate(
            page,
            `JSON.stringify({ clicks: window.seekClicks, seconds: window.seekSeconds })`
          )
        );
        assert(
          seekResult.clicks === 1 && seekResult.seconds >= 220 && seekResult.seconds <= 230,
          "youtube-controls should leave pointer seeking fully interactive."
        );
        page.close();

        const holdPage = await edge.newPage();
        await navigate(holdPage, `${baseUrl}/watch`, 500);
        await injectRuntimeSource(
          holdPage,
          buildInjectedSource({
            storageSync: { autoplayEnabled: false, captionsOff: true },
            files: [path.join(SHARED, "youtube-controls", "content.js")]
          })
        );
        await delay(600);
        await evaluate(holdPage, "window.firePlay(0)");
        await delay(100);
        const heldOnce = await evaluate(holdPage, "window.pauseCalls");
        assert(heldOnce === 1, "youtube-controls should hold the opening frame paused.");

        await evaluate(holdPage, "window.firePlay(0)");
        await delay(100);
        const heldTwice = await evaluate(holdPage, "window.pauseCalls");
        assert(
          heldTwice === 1,
          "youtube-controls should hold a watch page paused only once, so pressing play sticks."
        );
        holdPage.close();

        const resumePage = await edge.newPage();
        await navigate(resumePage, `${baseUrl}/watch`, 500);
        await injectRuntimeSource(
          resumePage,
          buildInjectedSource({
            storageSync: { autoplayEnabled: false, captionsOff: true },
            files: [path.join(SHARED, "youtube-controls", "content.js")]
          })
        );
        await delay(600);
        await evaluate(resumePage, "window.firePlay(300)");
        await delay(100);
        const midVideoPauses = await evaluate(resumePage, "window.pauseCalls");
        assert(
          midVideoPauses === 0,
          "youtube-controls should never pause a video that is already past its opening seconds."
        );
        resumePage.close();

        const disabledPage = await edge.newPage();
        const disabledSource = buildInjectedSource({
          storageSync: {
            autoplayEnabled: false,
            captionsOff: false,
            holdPaused: false
          },
          files: [path.join(SHARED, "youtube-controls", "content.js")]
        });
        await navigate(disabledPage, `${baseUrl}/watch`, 500);
        await injectRuntimeSource(disabledPage, disabledSource);
        await delay(1000);
        const disabledCaptionClicks = await evaluate(disabledPage, "window.captionClicks");
        assert(
          disabledCaptionClicks === 0,
          "youtube-controls should leave captions alone when suppression is disabled."
        );
        await evaluate(disabledPage, "window.firePlay(0)");
        await delay(100);
        const disabledPauses = await evaluate(disabledPage, "window.pauseCalls");
        assert(
          disabledPauses === 0,
          "youtube-controls should let videos start when Open videos paused is off."
        );
        disabledPage.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          storageSync: {
            autoplayEnabled: false,
            captionsOff: true
          },
          files: [path.join(SHARED, "youtube-controls", "content.js")]
        });
        await navigate(page, `${baseUrl}/watch?delayed=1`, 500);
        await injectRuntimeSource(page, source);
        await delay(14500);
        const result = JSON.parse(
          await evaluate(
            page,
            `JSON.stringify({
              clicks: window.toggleClicks,
              label: document.querySelector('.ytp-autonav-toggle-button')?.getAttribute('aria-label') || '',
              captionClicks: window.captionClicks,
              captionsPressed: document.querySelector('.ytp-subtitles-button')?.getAttribute('aria-pressed') || ''
            })`
          )
        );
        assert(
          result.clicks === 1 && result.label === "Autoplay is off",
          "youtube-controls should still disable autoplay when YouTube inserts the toggle late."
        );
        assert(
          result.captionClicks === 1 && result.captionsPressed === "false",
          "youtube-controls should still disable captions when YouTube inserts the CC button late."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          storageSync: {
            preferredQuality: "1080p"
          },
          files: [
            path.join(SHARED, "youtube-quality", "main-world.js"),
            path.join(SHARED, "youtube-quality", "content.js")
          ]
        });
        await navigate(page, `${baseUrl}/watch?quality=1`, 500);
        await injectRuntimeSource(page, source);
        await delay(1800);
        const calls = JSON.parse(await evaluate(page, "JSON.stringify(window.qualityCalls)"));
        assert(
          calls.some((entry) => entry.min === "hd1080" && entry.max === "hd1080") &&
            calls.some((entry) => entry.value === "hd1080"),
          "youtube-quality should cap the player quality at the stored ceiling."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          files: [
            path.join(SHARED, "tenhou-english", "translations.js"),
            path.join(SHARED, "tenhou-english", "content.js")
          ]
        });
        await navigate(page, `${baseUrl}/tenhou`, 500);
        await injectRuntimeSource(page, source);
        await delay(900);
        const text = await evaluate(page, "document.body.innerText");
        assert(
          text.includes("Match") && text.includes("Riichi") && text.includes("Draw"),
          "tenhou-english should translate static and dynamic text nodes."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          storageSync: {
            searchTemplate: "https://libby.example/search?q={title}+{author}+{isbn}"
          },
          extra: "window.__RIAH_LIBRARY_LOOKUP_HOST__ = 'www.amazon.com';",
          files: [path.join(SHARED, "library-search", "content.js")]
        });
        await navigate(page, `${baseUrl}/amazon`, 500);
        await injectRuntimeSource(page, source);
        await delay(1500);
        const result = JSON.parse(
          await evaluate(
            page,
            `(() => {
              const button = document.getElementById('riah-library-search-button');
              if (button) {
                button.click();
              }
              return JSON.stringify({
                buttonPresent: !!button,
                opened: window.__riahTest.openedUrls[0] || null
              });
            })()`
          )
        );
        assert(
          result.buttonPresent &&
            result.opened.includes("The%20Testing%20Book") &&
            result.opened.includes("Ada%20Lovelace") &&
            result.opened.includes("9781234567890"),
          "library-search should inject a button and open the configured library search template."
        );
        page.close();

        const unsafePage = await edge.newPage();
        const unsafeSource = buildInjectedSource({
          storageSync: {
            searchTemplate: "javascript:alert(1)//{title}"
          },
          extra: "window.__RIAH_LIBRARY_LOOKUP_HOST__ = 'www.amazon.com';",
          files: [path.join(SHARED, "library-search", "content.js")]
        });
        await navigate(unsafePage, `${baseUrl}/amazon`, 500);
        await injectRuntimeSource(unsafePage, unsafeSource);
        await delay(1500);
        const unsafeOpened = await evaluate(
          unsafePage,
          `(() => {
            document.getElementById('riah-library-search-button')?.click();
            return window.__riahTest.openedUrls.length;
          })()`
        );
        assert(
          unsafeOpened === 0,
          "library-search should reject non-HTTP search templates before opening them."
        );
        unsafePage.close();
      } finally {
        await edge.close();
      }
    }

    {
      const edge = await startEdge();
      try {
        const page = await edge.newPage();
        const source = buildInjectedSource({
          storageSync: {
            includeReplies: false
          },
          extra: "window.scrollBy = function() {};",
          files: [path.join(SHARED, "timeline-exporter", "content.js")]
        });
        await navigate(page, `${baseUrl}/x`, 500);
        await injectRuntimeSource(page, source);
        await evaluate(
          page,
          `window.__riahInvokeMessage({ type: 'riah-timeline-exporter-start', includeReplies: false })`,
          true
        );
        await delay(1200);
        const status = JSON.parse(
          await evaluate(
            page,
            `(async () => JSON.stringify(await window.__riahInvokeMessage({ type: 'riah-timeline-exporter-status' })))()`,
            true
          )
        );
        await evaluate(
          page,
          `window.__riahInvokeMessage({ type: 'riah-timeline-exporter-download' })`,
          true
        );
        const messages = JSON.parse(await evaluate(page, "JSON.stringify(window.__riahTest.runtimeMessages)"));
        assert(status.count === 2, "timeline-exporter should collect all visible tweets into its in-memory map.");
        assert(
          messages[0].type === "riah-timeline-exporter-download" &&
            messages[0].csv.includes("111") &&
            messages[0].csv.includes("222"),
          "timeline-exporter should generate CSV output before asking the background page to download it."
        );
        page.close();
      } finally {
        await edge.close();
      }
    }
  } finally {
    await server.close();
  }
}

async function main() {
  console.log("Refreshing dist/ before tests...");
  execFileSync(process.execPath, ["build.js"], {
    cwd: ROOT,
    stdio: "inherit"
  });

  const suites = [
    ["Static audit", runStaticAudit],
    ["Background unit tests", runBackgroundUnitTests],
    ["Browser smoke tests", runBrowserSmokeTests]
  ];

  for (const [name, fn] of suites) {
    console.log(`\n[${name}]`);
    await fn();
    console.log(`PASS ${name}`);
  }

  console.log("\nAll checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
