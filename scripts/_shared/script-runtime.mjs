// Shared primitives for scripts/**/*.mjs drivers.
//
// Every driver reaches for the same trio: resolve the repo root from
// `import.meta.url`, load a TypeScript lib via native import (Node's type
// stripping, engines >= 22.18), and die with a
// prefixed message + structured exit code. Centralizing them keeps each
// driver as a thin shell (~6 lines) and removes the drift that previously
// left gen-version with no error handling while gen-rule rolled its own
// `fail()` helper.
//
// Layout-aware root + name resolution. Drivers may live at any depth
// under `<root>/scripts/` (`scripts/x.mjs`, `scripts/gen/rule.mjs`,
// `scripts/bench/run.mjs`, …). The helpers locate `/scripts/` in
// the caller's path and derive root + name from the split, so adding a
// new sub-directory does not require touching this module.
//
// This module lives under scripts/_shared/ — the underscore prefix
// sorts it ahead of the per-context dirs (scripts/check/, scripts/gen/,
// scripts/bench/) so `ls scripts/` immediately groups
// the cross-context utilities at the top.

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const SCRIPTS_SEG = `${path.sep}scripts${path.sep}`;

/**
 * Locate the repo root by splitting the caller's path on `/scripts/` and
 * returning the prefix. Works for any nesting (scripts/x.mjs,
 * scripts/gen/rule.mjs, scripts/gen/lib/foo.ts). Throws if the caller is
 * not under a `scripts/` directory at all — that would mean the helper
 * was invoked from a non-driver location and any downstream `loadLib`
 * would resolve against the wrong base.
 */
const NOT_FOUND = -1;
const FIRST_INDEX = 0;
const DEFAULT_EXIT_CODE = 1;

export const resolveRoot = (importMetaUrl) => {
  const filePath = fileURLToPath(importMetaUrl);
  const idx = filePath.lastIndexOf(SCRIPTS_SEG);
  if (idx === NOT_FOUND) {
    throw new Error(`script-runtime: caller is not under scripts/: ${filePath}`);
  }
  return filePath.slice(FIRST_INDEX, idx);
};

/**
 * Compose the driver's identifier from its path under scripts/. The path
 * relative to `scripts/` is dash-joined and stripped of `.mjs`, so:
 *   - `scripts/x.mjs`               → `x`
 *   - `scripts/gen/rule.mjs`        → `gen-rule`
 *   - `scripts/bench/run.mjs` → `bench-run`
 * The dash-join preserves the `<context>-<name>` identity that drivers
 * historically carried in their filename, so error-message prefixes
 * (`gen-rule: invalid id`) stay stable across the directory-layout
 * migration.
 */
export const scriptName = (importMetaUrl) => {
  const filePath = fileURLToPath(importMetaUrl);
  const idx = filePath.lastIndexOf(SCRIPTS_SEG);
  if (idx === NOT_FOUND) {
    // Caller is outside scripts/; fall back to a bare basename so stray
    // test fixtures (e.g. /tmp/foo.mjs) still produce a usable tag.
    const base = filePath.split(path.sep).pop() ?? '';
    return base.replace(/\.mjs$/u, '');
  }
  const rel = filePath.slice(idx + SCRIPTS_SEG.length);
  return rel
    .replace(/\.mjs$/u, '')
    .split(path.sep)
    .join('-');
};

const extractError = (value) => {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  let message = String(value);
  if (typeof value === 'string') {
    message = value;
  }
  return { message };
};

const writeFail = (
  messageOrError,
  { name, errStream, env, exit },
  exitCode = DEFAULT_EXIT_CODE,
) => {
  const { message, stack } = extractError(messageOrError);
  errStream.write(`${name}: ${message}\n`);
  if (typeof stack !== 'undefined' && env.SIRO_DEBUG === '1') {
    errStream.write(`${stack}\n`);
  }
  return exit(exitCode);
};

const writeSuccess = (outStream, label) => {
  outStream.write(`${label}\n`);
};

// Node caches ESM modules by URL, and loadLib callers run inside one
// long-lived process (gen-rule writes a .ts, then re-reads it). A unique
// query makes { fresh: true } re-evaluate the ENTRY module from disk.
// Transitive imports of that entry stay cached, so callers must bust the
// exact file they rewrote — not an importer of it (see gen/rule.mjs).
let loadCounter = 0;
const INCREMENT = 1;

const importLib = (relPath, { root, fileExists }, options = {}) => {
  if (!fileExists(path.join(root, 'package.json'))) {
    return Promise.reject(
      new Error(
        `script-runtime: computed root has no package.json. root=${root} loadLib(${relPath})`,
      ),
    );
  }
  const url = pathToFileURL(path.join(root, relPath));
  if (options.fresh) {
    loadCounter += INCREMENT;
    url.searchParams.set('siro-load', String(loadCounter));
  }
  return import(url.href);
};

const resolveDeps = (deps) => ({
  env: deps.env ?? process.env,
  errStream: deps.errStream ?? process.stderr,
  exit: deps.exit ?? process.exit.bind(process),
  fileExists: deps.fileExists ?? existsSync,
  outStream: deps.outStream ?? process.stdout,
});

export const createScriptContext = (importMetaUrl, deps = {}) => {
  const root = resolveRoot(importMetaUrl);
  const name = scriptName(importMetaUrl);
  const { exit, errStream, outStream, env, fileExists } = resolveDeps(deps);

  const failCtx = { env, errStream, exit, name };
  const fail = (messageOrError, exitCode = DEFAULT_EXIT_CODE) =>
    writeFail(messageOrError, failCtx, exitCode);
  const logSuccess = (label) => writeSuccess(outStream, label);

  const libCtx = { fileExists, root };
  const loadLib = (relPath, options = {}) => importLib(relPath, libCtx, options);

  return { fail, loadLib, logSuccess, name, root };
};
