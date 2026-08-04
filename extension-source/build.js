#!/usr/bin/env node
"use strict";

/**
 * Build shared/<extension>/ into dist/chrome/<extension>/ and
 * dist/firefox/<extension>/.
 *
 * For each extension folder under shared/:
 *   - Copy every file except manifest.chrome.json and manifest.firefox.json.
 *   - Copy manifest.chrome.json to dist/chrome/<extension>/manifest.json.
 *   - Copy manifest.firefox.json to dist/firefox/<extension>/manifest.json.
 *
 * Shared library folders are vendored into an extension when that extension
 * references the library folder by path. Browser extensions cannot import code
 * from sibling extension folders at runtime, so shared code must be copied into
 * each built package that uses it.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SHARED = path.join(ROOT, "shared");
const DIST = path.join(ROOT, "dist");

const CHROME_MANIFEST = "manifest.chrome.json";
const FIREFOX_MANIFEST = "manifest.firefox.json";

function rmrf(targetPath) {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copyDir(src, dst, skip = new Set()) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d, skip);
    } else {
      copyFile(s, d);
    }
  }
}

function isExtensionFolder(folder) {
  return (
    fs.existsSync(path.join(folder, CHROME_MANIFEST)) ||
    fs.existsSync(path.join(folder, FIREFOX_MANIFEST))
  );
}

function listSharedDirs() {
  return fs
    .readdirSync(SHARED, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function readAllText(dir) {
  const textExtensions = new Set([
    ".js",
    ".mjs",
    ".cjs",
    ".html",
    ".htm",
    ".css",
    ".json",
    ".md",
    ".txt",
    ".svg"
  ]);
  let buffer = "";

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (!textExtensions.has(path.extname(entry.name))) continue;
      try {
        buffer += fs.readFileSync(entryPath, "utf8") + "\n";
      } catch {
        // Ignore unreadable source files. The actual build copy will surface
        // filesystem errors for files that are required.
      }
    }
  }

  walk(dir);
  return buffer;
}

function detectLibsUsed(extensionSource, libs) {
  const text = readAllText(extensionSource);
  const used = [];
  for (const lib of libs) {
    const patterns = [
      new RegExp(`['"\`/]${lib}/`),
      new RegExp(`['"\`]\\./${lib}['"\`/]`),
      new RegExp(`src=['"]${lib}/`)
    ];
    if (patterns.some((pattern) => pattern.test(text))) used.push(lib);
  }
  return used;
}

function buildExtension(name, browser, libs) {
  const src = path.join(SHARED, name);
  const dst = path.join(DIST, browser, name);
  const manifestName = browser === "chrome" ? CHROME_MANIFEST : FIREFOX_MANIFEST;
  const manifestPath = path.join(src, manifestName);

  if (!fs.existsSync(manifestPath)) {
    console.warn(`  [skip ${browser}] ${name} missing ${manifestName}`);
    return false;
  }

  rmrf(dst);
  copyDir(src, dst, new Set([CHROME_MANIFEST, FIREFOX_MANIFEST]));
  copyFile(manifestPath, path.join(dst, "manifest.json"));

  const used = detectLibsUsed(src, libs);
  for (const lib of used) {
    copyDir(path.join(SHARED, lib), path.join(dst, lib));
  }
  if (used.length) {
    console.log(`    vendored: ${used.join(", ")}`);
  }
  return true;
}

function main() {
  if (!fs.existsSync(SHARED)) {
    console.error(`No shared/ directory at ${SHARED}`);
    process.exit(1);
  }

  const allDirs = listSharedDirs();
  const extensions = allDirs.filter((dir) => isExtensionFolder(path.join(SHARED, dir)));
  const libs = allDirs.filter((dir) => !isExtensionFolder(path.join(SHARED, dir)));

  console.log(`Building ${extensions.length} extension(s)...`);
  if (libs.length) {
    console.log(`Shared libraries available: ${libs.join(", ")}`);
  }
  console.log();

  rmrf(DIST);

  let chromeOk = 0;
  let firefoxOk = 0;

  for (const name of extensions) {
    console.log(`- ${name}`);
    if (buildExtension(name, "chrome", libs)) chromeOk += 1;
    if (buildExtension(name, "firefox", libs)) firefoxOk += 1;
  }

  console.log(`\nDone. chrome: ${chromeOk}/${extensions.length}, firefox: ${firefoxOk}/${extensions.length}`);
  console.log(`Output: ${path.relative(ROOT, DIST)}/`);
}

if (require.main === module) {
  main();
}
