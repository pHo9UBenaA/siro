#!/usr/bin/env node
// Verify the hexagonal layering contract for src/.
//
// The layer responsibilities and the dependency rule live in ONE prose place,
// `docs/contributing.md` §"Layering" (and the decision D01); the ENFORCED data
// is `allowedDependencies` below. This header deliberately does not restate the
// table so it can't drift — only the gate-specific operational notes follow.
//
// Placement convention by responsibility:
//   - implements a port for a concrete runtime / format / sink → adapters
//   - orchestrates a multi-port flow on behalf of a CLI command → application
//   - everything else that depends only on port abstractions (rule defs,
//     pure transforms, registries, projections, ctx-only predicates) → domain
//   - has no dependency on any other layer → shared
//
// Allowances (file-level escape hatches):
//   - `application/commands/lint.ts` may import from `adapters/`.
//     Each command is its own composition root: it builds the concrete
//     port graph the use case needs without leaking the wiring into the
//     rest of application/.
//   - `index.ts` and `version.ts` are entry points: skipped as a SOURCE
//     (composing every layer is their job). They differ as a TARGET. `index.ts`
//     is the public-API barrel (`barrelFiles`) — a non-cli layer importing it
//     re-exports adapters/etc. into itself transitively, so that edge is a
//     `barrel` violation and only `cli` may import it. `version.ts` is a
//     re-export-less leaf — layer-less and freely importable by any layer.
//   - `cli.ts` is the composition root: it belongs to the `cli` layer, which
//     is allowed to import from every other layer by the dependency rule, so
//     its cross-layer imports are permitted rather than skipped.

import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';

const ctx = createScriptContext(import.meta.url);
const srcRoot = path.join(ctx.root, 'src');

const { findLayerViolations, formatViolation } = await ctx.loadLib('scripts/check/lib/layers.ts');

const allowedDependencies = {
  adapters: new Set(['domain', 'shared']),
  application: new Set(['domain', 'shared']),
  cli: new Set(['application', 'adapters', 'domain', 'shared']),
  domain: new Set(['shared']),
  shared: new Set(),
};

const allowList = new Map([
  ['application/commands/lint.ts', new Set(['adapters'])],
  // Shared composition-root preamble for lint; wires the concrete port
  // graph (loadConfig, createRepoContext) just like a command would.
  ['application/prepare-context.ts', new Set(['adapters'])],
]);

const allowedPackages = {
  adapters: new Set(['node:', 'jiti', 'valibot', 'ini', 'smol-toml', 'yaml', 'picocolors']),
  application: new Set(),
  cli: new Set(['node:', 'cac']),
  domain: new Set(['valibot']),
  shared: new Set(),
};

const entryFiles = new Set(['index.ts', 'version.ts']);
// The public-API barrel only. `.js` is included so an extension-explicit
// import of the built barrel is caught as a back-edge too; version.ts is an
// entry file but a re-export-less leaf, so it stays out of this set and any
// layer may import it.
const barrelFiles = new Set(['index.ts', 'index.js']);

// glob from node:fs/promises is Node ≥22; readdirSync({recursive:true}) works
// on Node ≥20 which the CI matrix still targets.
const TS_EXT = '.ts';
const files = readdirSync(srcRoot, { recursive: true, withFileTypes: true })
  .filter((de) => de.isFile() && de.name.endsWith(TS_EXT))
  .map((de) => {
    // parentPath is absolute; join with name for the full path.
    const abs = path.join(de.parentPath ?? srcRoot, de.name);
    // Normalize to POSIX so the pure checker's path arithmetic is
    // platform-agnostic.
    const relPath = path.relative(srcRoot, abs).split(path.sep).join('/');
    return { content: readFileSync(abs, 'utf8'), relPath };
  });

const offenders = findLayerViolations(files, {
  allowList,
  allowedDependencies,
  allowedPackages,
  barrelFiles,
  entryFiles,
});

const EMPTY = 0;
if (offenders.length > EMPTY) {
  // Compose the diagnostic as a single block so the violations and the
  // allowed-targets cheatsheet stay together on stderr — splitting them
  // across two writes risks interleaving with unrelated output in CI
  // log capture. The cheatsheet is derived from `allowedDependencies`
  // (the same data the checker enforces) so it cannot drift out of sync
  // with the rule actually applied.
  const pad = Math.max(...Object.keys(allowedDependencies).map((key) => key.length));
  const cheatsheet = Object.entries(allowedDependencies).map(([from, targets]) => {
    let list = [...targets].join(', ');
    if (targets.size === EMPTY) {
      list = '(nothing)';
    }
    return `  ${from.padEnd(pad)} → ${list}`;
  });
  const lines = [
    'Layering violations:',
    '',
    ...offenders.map((viol) => `  ${formatViolation(viol)}`),
    '',
    'Allowed dependencies per layer:',
    ...cheatsheet,
  ];
  ctx.fail(lines.join('\n'));
}

ctx.logSuccess('Layering: no violations detected.');
