/**
 * Inventory installed Chromium extensions from the local profile on disk.
 * No browser API, no management permission - reads Preferences + Extension folders.
 *
 * Usage:
 *   node scripts/inventory-extensions.mjs
 *   node scripts/inventory-extensions.mjs --browser brave
 *   node scripts/inventory-extensions.mjs --browser chrome --profile "Profile 1"
 *   node scripts/inventory-extensions.mjs --json
 *
 * Output is a triage table an agent can turn into a rebuild plan.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOCATION = {
  1: "internal",
  2: "external-pref",
  3: "external-registry",
  4: "unpacked",
  5: "component",
  6: "external-download",
  7: "policy-download",
  8: "command-line",
  9: "policy",
  10: "external-component",
};

/** Rough job matches against this repo - suggestions, not verdicts. */
const RIAH_HINTS = [
  { re: /autoplay|media.?guard/i, slug: "autoplay-guard", job: "block unwanted autoplay" },
  { re: /cookie|consent|i\s*don.?t\s*care|autoconsent|consent.?o.?matic/i, slug: "cookie-quiet", job: "dismiss cookie banners" },
  { re: /paste|clipboard/i, slug: "paste-guard", job: "restore paste" },
  { re: /right.?click|context.?menu|enable.?copy|absolute.?enable/i, slug: "right-click-restorer", job: "restore right-click / copy" },
  { re: /volume|loud|sound.?booster|audio.?boost/i, slug: "volume-boost", job: "boost / mute tab audio" },
  { re: /youtube.*(quality|resolution|hd)|enhancer.?for.?youtube|magic.?actions.?for.?youtube/i, slug: "youtube-quality / youtube-controls", job: "YouTube quality / pause / autoplay" },
  { re: /sponsorblock|return.?youtube/i, slug: null, job: "YouTube extras - keep or fork carefully; not in this repo" },
  { re: /tab.?discard|tab.?suspend|the.?great.?suspender|auto.?discard/i, slug: "tab-sleeper (Firefox) or use native Memory Saver", job: "sleep idle tabs" },
  { re: /detach|tab.?anchor|pop.?out/i, slug: "tab-anchor", job: "re-dock detached tabs" },
];

const KEEP_HINTS = [
  { re: /bitwarden|1password|lastpass|keeper|dashlane|proton.?pass/i, why: "password manager - do not DIY" },
  { re: /ublock|adguard|ad.?block|brave.?shields/i, why: "filter-list ecosystem - keep a known good blocker" },
  { re: /authenticator|otp|twilio.?auth|aegis/i, why: "2FA - keep the trusted one" },
  { re: /vimium|dark.?reader|stylus|tampermonkey|violentmonkey|greasemonkey/i, why: "power-user platform; replace only if you already maintain scripts" },
  { re: /grammarly|language.?tool|honey|rakuten|capital.?one.?shopping/i, why: "account / affiliate surface - high replace priority, but rebuild only if you truly need the job" },
  { re: /metamask|phantom|wallet|crypto/i, why: "wallet - never reinvent" },
];

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function localAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
}

function browserRoots(browser) {
  const la = localAppData();
  const map = {
    brave: [path.join(la, "BraveSoftware", "Brave-Browser", "User Data")],
    chrome: [path.join(la, "Google", "Chrome", "User Data")],
    edge: [path.join(la, "Microsoft", "Edge", "User Data")],
  };
  return map[browser] || map.brave;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function loadSettings(profileDir) {
  const secure = readJson(path.join(profileDir, "Secure Preferences"));
  const prefs = readJson(path.join(profileDir, "Preferences"));
  const fromSecure = secure?.extensions?.settings || {};
  const fromPrefs = prefs?.extensions?.settings || {};
  // Merge; Secure Preferences usually wins for Chromium.
  return { ...fromPrefs, ...fromSecure };
}

function resolveManifest(profileDir, id, info) {
  if (info?.manifest && info.manifest.name) return info.manifest;
  const candidates = [];
  if (info?.path) candidates.push(path.join(info.path, "manifest.json"));
  const extDir = path.join(profileDir, "Extensions", id);
  if (fs.existsSync(extDir)) {
    for (const ver of fs.readdirSync(extDir).sort().reverse()) {
      candidates.push(path.join(extDir, ver, "manifest.json"));
    }
  }
  for (const c of candidates) {
    const m = readJson(c);
    if (m) return m;
  }
  return null;
}

function flattenPerms(manifest, info) {
  const api = new Set();
  const hosts = new Set();
  const m = manifest || {};
  for (const p of m.permissions || []) {
    if (typeof p === "string" && (p.includes("://") || p.startsWith("<"))) hosts.add(p);
    else if (typeof p === "string") api.add(p);
  }
  for (const p of m.host_permissions || []) hosts.add(p);
  const granted = info?.granted_permissions || info?.active_permissions || {};
  for (const p of granted.api || granted.manifest_permissions || []) api.add(p);
  for (const p of granted.explicit_host || granted.scriptable_host || []) hosts.add(p);
  return { api: [...api], hosts: [...hosts] };
}

function riskFlags({ api, hosts }, location) {
  const flags = [];
  const joined = [...api, ...hosts].join(" ").toLowerCase();
  if (hosts.some((h) => h === "<all_urls>" || h === "*://*/*" || h === "http://*/*" || h === "https://*/*")) {
    flags.push("broad-hosts");
  }
  if (api.includes("management")) flags.push("can-manage-other-extensions");
  if (api.includes("debugger")) flags.push("debugger");
  if (api.includes("proxy")) flags.push("proxy");
  if (api.includes("webRequest") || api.includes("webRequestBlocking") || api.includes("declarativeNetRequest")) {
    flags.push("network-intercept");
  }
  if (api.includes("cookies") || api.includes("history") || api.includes("tabs")) flags.push("sensitive-api");
  if (location === 4) flags.push("unpacked-local");
  if (/nativeMessaging/i.test(joined)) flags.push("native-messaging");
  return flags;
}

function matchHints(name) {
  const keep = KEEP_HINTS.find((h) => h.re.test(name || ""));
  const riah = RIAH_HINTS.find((h) => h.re.test(name || ""));
  return { keep, riah };
}

function triage(row) {
  if (row.location === 5 || row.wasInstalledByDefault) {
    return { bucket: "skip", reason: "browser component / default - leave it" };
  }
  if (/^Riah\b/i.test(row.name) && row.location === 4) {
    return { bucket: "skip", reason: "already a local Riah-style rebuild" };
  }
  if (row.keep) {
    return { bucket: "keep", reason: row.keep.why };
  }
  if (row.riah) {
    const slug = row.riah.slug || "a small one-job tool";
    return {
      bucket: "replace-candidate",
      reason: "same job as " + slug + " (" + row.riah.job + ")",
    };
  }
  if (row.flags.includes("broad-hosts") && row.api.length <= 3) {
    return {
      bucket: "replace-candidate",
      reason: "tiny feature with broad site access - good DIY target",
    };
  }
  if (row.fromWebstore === false && row.location === 4) {
    return { bucket: "review", reason: "local unpacked - confirm you still trust the folder" };
  }
  if (row.flags.includes("proxy") || row.flags.includes("debugger") || row.flags.includes("can-manage-other-extensions")) {
    return { bucket: "review", reason: "powerful permissions - keep only if you know why" };
  }
  if (row.flags.includes("broad-hosts")) {
    return { bucket: "review", reason: "runs on many sites - audit publisher + update history" };
  }
  return { bucket: "review", reason: "no automatic match - decide from the job it does" };
}

function inventory(profileDir) {
  const settings = loadSettings(profileDir);
  const rows = [];
  for (const [id, info] of Object.entries(settings)) {
    if (!info || typeof info !== "object") continue;
    const manifest = resolveManifest(profileDir, id, info);
    const name = manifest?.name || id;
    // Skip chrome i18n placeholders that never resolved and bare ids with no files
    if (!manifest && !info.path && !fs.existsSync(path.join(profileDir, "Extensions", id))) {
      // often stale permission stubs
      if (!info.location && !info.from_webstore && Object.keys(info).length <= 2) continue;
    }
    const { api, hosts } = flattenPerms(manifest, info);
    const location = info.location;
    const flags = riskFlags({ api, hosts }, location);
    const { keep, riah } = matchHints(typeof name === "string" ? name : id);
    const row = {
      id,
      name: typeof name === "string" ? name : id,
      version: manifest?.version || null,
      enabled: !(Array.isArray(info.disable_reasons) && info.disable_reasons.length) && info.state !== 0,
      location,
      locationLabel: LOCATION[location] || (location == null ? "unknown" : String(location)),
      fromWebstore: info.from_webstore === true,
      wasInstalledByDefault: info.was_installed_by_default === true,
      api,
      hosts,
      flags,
      keep: keep || null,
      riah: riah || null,
    };
    const t = triage(row);
    row.bucket = t.bucket;
    row.reason = t.reason;
    rows.push(row);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

function printMarkdown(rows, meta) {
  const lines = [];
  lines.push(`# Extension inventory`);
  lines.push("");
  lines.push(`- Browser profile: \`${meta.profileDir}\``);
  lines.push(`- Counted: **${rows.length}** (components included unless empty stubs)`);
  lines.push("");
  const buckets = ["replace-candidate", "review", "keep", "skip"];
  for (const bucket of buckets) {
    const subset = rows.filter((r) => r.bucket === bucket);
    if (!subset.length) continue;
    lines.push(`## ${bucket} (${subset.length})`);
    lines.push("");
    lines.push(`| Name | Source | Flags | Note |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const r of subset) {
      const source = r.fromWebstore ? "store" : r.locationLabel;
      const flags = r.flags.join(", ") || "-";
      lines.push(`| ${r.name.replace(/\|/g, "/")} | ${source} | ${flags} | ${r.reason} |`);
    }
    lines.push("");
  }
  lines.push(`## Next`);
  lines.push("");
  lines.push(`1. Pick one **replace-candidate**.`);
  lines.push(`2. Open \`docs/BUILD-YOUR-OWN.md\` and rebuild from \`extension-source/shared/_template/\` or an existing slug.`);
  lines.push(`3. Load unpacked, disable the old store extension, live with it a day.`);
  lines.push("");
  return lines.join("\n");
}

function main() {
  const browser = (argValue("--browser") || "brave").toLowerCase();
  const profileName = argValue("--profile") || "Default";
  const asJson = hasFlag("--json");
  const roots = browserRoots(browser);
  const root = roots.find((r) => fs.existsSync(r));
  if (!root) {
    console.error(`No user-data folder found for ${browser}. Looked at:\n` + roots.map((r) => `  ${r}`).join("\n"));
    process.exit(1);
  }
  const profileDir = path.join(root, profileName);
  if (!fs.existsSync(profileDir)) {
    console.error(`Profile not found: ${profileDir}`);
    process.exit(1);
  }
  const rows = inventory(profileDir);
  if (asJson) {
    process.stdout.write(JSON.stringify({ browser, profileDir, extensions: rows }, null, 2) + "\n");
  } else {
    process.stdout.write(printMarkdown(rows, { profileDir }) + "\n");
  }
}

main();