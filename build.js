#!/usr/bin/env node
/**
 * Root entry point for the recovered, tested extension source tree.
 *
 * The implemented extensions currently live under
 * `extension-source/`. Keep the root command stable while that
 * source is consolidated in a later, dedicated file-move pass.
 */

const path = require("path");
const { spawnSync } = require("child_process");

const implementationRoot = path.join(__dirname, "extension-source");
const buildScript = path.join(implementationRoot, "build.js");
const result = spawnSync(process.execPath, [buildScript], {
  cwd: implementationRoot,
  stdio: "inherit"
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
