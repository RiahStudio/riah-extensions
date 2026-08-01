#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(REPO, "extension-source");
const DIST = path.join(SOURCE_ROOT, "dist");
const RELEASE = path.join(REPO, "release");
// Chrome, Edge and Brave are all Chromium and take the byte-identical package,
// so there is one Chromium build, not three. Each store still needs its own
// upload, so Edge gets its own zip cut from the same dist/chrome tree.
const BROWSERS = ["chrome", "edge", "firefox"];
const DIST_FOR = { chrome: "chrome", edge: "chrome", firefox: "firefox" };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { time, date: dosDate };
}

function walkFiles(dir) {
  const files = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }

  walk(dir);
  return files;
}

function writeZip(sourceDir, zipPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const filePath of walkFiles(sourceDir)) {
    const relativeName = path.relative(sourceDir, filePath).replace(/\\/g, "/");
    const name = Buffer.from(relativeName, "utf8");
    const data = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    const crc = crc32(data);
    const stamp = dosDateTime(stats.mtime);
    const localOffset = offset;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, data);
    offset += local.length + name.length + data.length;

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(localOffset, 42);
    centralParts.push(central, name);
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const fileCount = centralParts.length / 2;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(fileCount, 8);
  end.writeUInt16LE(fileCount, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  fs.mkdirSync(path.dirname(zipPath), { recursive: true });
  fs.writeFileSync(zipPath, Buffer.concat([...localParts, ...centralParts, end]));
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function activeRegistryEntries() {
  const registry = readJson(path.join(REPO, "extensions-registry.json"));
  return registry.extensions.filter((extension) => extension.status === "active");
}

function build() {
  const result = spawnSync(process.execPath, [path.join(REPO, "build.js")], {
    cwd: REPO,
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function main() {
  build();
  fs.rmSync(RELEASE, { recursive: true, force: true });
  fs.mkdirSync(RELEASE, { recursive: true });

  const sums = [];
  const extensions = activeRegistryEntries()
    .map((extension) => ({
      slug: extension.id,
      browsers: new Set(extension.browsers_supported || BROWSERS)
    }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  for (const browser of BROWSERS) {
    const outDir = path.join(RELEASE, browser);

    for (const extension of extensions) {
      if (!extension.browsers.has(browser)) {
        continue;
      }

      const sourceDir = path.join(DIST, DIST_FOR[browser], extension.slug);
      if (!fs.existsSync(sourceDir)) {
        throw new Error(`Missing built package for ${extension.slug} on ${browser}.`);
      }

      const manifest = readJson(path.join(sourceDir, "manifest.json"));
      const version = String(manifest.version || "0.0.0").replace(/[^\w.-]+/g, "-");
      const zipName = `${extension.slug}-${version}-${browser}.zip`;
      const zipPath = path.join(outDir, zipName);
      writeZip(sourceDir, zipPath);
      const relative = path.relative(REPO, zipPath).replace(/\\/g, "/");
      sums.push(`${sha256(zipPath)}  ${relative}`);
      console.log(`packaged ${relative}`);
    }
  }

  fs.writeFileSync(path.join(RELEASE, "SHA256SUMS.txt"), sums.join("\n") + "\n", "utf8");
  console.log(`wrote ${path.relative(REPO, path.join(RELEASE, "SHA256SUMS.txt"))}`);
}

main();
