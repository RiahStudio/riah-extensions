#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = "extension-source/shared";
const SCAN_DIRS = [SOURCE_ROOT, "extension-source/tests"];
const SCAN_FILES = ["build.js", "extension-source/build.js"];
const SKIP_DIRS = new Set(["dist", "node_modules", "scratch", ".git"]);
const PATTERNS = [
  { kind: "function", re: /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/ },
  { kind: "class", re: /^\s*class\s+([A-Za-z_$][\w$]*)\b/ },
  { kind: "const", re: /^\s*const\s+([A-Za-z_$][\w$]*)\s*=/ },
  { kind: "let", re: /^\s*let\s+([A-Za-z_$][\w$]*)\s*=/ },
  { kind: "var", re: /^\s*var\s+([A-Za-z_$][\w$]*)\s*=/ }
];

function walk(dir, files) {
  if (!fs.existsSync(dir)) {
    return;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
}

function discoverFiles() {
  const files = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(REPO, dir), files);
  }
  for (const file of SCAN_FILES) {
    const full = path.join(REPO, file);
    if (fs.existsSync(full)) {
      files.push(full);
    }
  }
  return [...new Set(files)].sort();
}

function relative(file) {
  return path.relative(REPO, file).replace(/\\/g, "/");
}

function indexFile(file) {
  const entries = [];
  const seen = new Set();
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of PATTERNS) {
      const match = lines[index].match(pattern.re);
      if (!match) {
        continue;
      }
      const key = `${pattern.kind}:${match[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({
          name: match[1],
          file: relative(file),
          line: index + 1,
          kind: pattern.kind
        });
      }
      break;
    }
  }
  return entries;
}

function main() {
  const files = discoverFiles();
  const entries = [
    {
      name: "Riah Extensions implemented source",
      file: SOURCE_ROOT,
      line: 1,
      kind: "source-root"
    }
  ];
  for (const file of files) {
    entries.push(...indexFile(file));
  }
  entries.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

  const output = path.join(REPO, "scratch", "AI_INDEX.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(entries, null, 2) + "\n", "utf8");
  console.log(`reindex: ${entries.length} entries across ${files.length} JavaScript files`);
  console.log(`source: ${SOURCE_ROOT}`);
  console.log(`wrote: ${relative(output)}`);
}

if (require.main === module) {
  main();
}

module.exports = { discoverFiles, indexFile };
