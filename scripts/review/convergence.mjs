#!/usr/bin/env node
// Convergence diagnostic for `/review`. Read-only.
//
// Reports the on-disk convergence state for a named axis: how many
// Consecutive clean rounds have landed at the current HEAD, what the
// Last round's verdict was, and what fraction of the last round's
// Findings overlapped REJECTED.md. Triage owns the authoritative
// Per-round verdict; this script is the maintainer's surface for
// Answering "why didn't the loop stop?" without spawning an LLM.
//
// Convergence rule: docs/review/AXES.md §Convergence

import { existsSync, readFileSync } from 'node:fs';
import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';

const ctx = createScriptContext(import.meta.url);

const ARGV_AXIS_INDEX = 2;
const EXIT_NOT_FOUND = 1;
const EXIT_USAGE = 2;
const CONVERGENCE_THRESHOLD = 2;
const CONFIRMATION_COUNT = 1;
const EMPTY_COUNT = 0;
const JSON_INDENT = 2;
const JSON_REPLACER = (_key, val) => val;

const [axis] = process.argv.slice(ARGV_AXIS_INDEX);
if (!axis) {
  ctx.fail('usage: review/convergence.mjs <axis>', EXIT_USAGE);
}

const statePath = path.resolve(ctx.root, '.claude/state/review-last-findings.json');
if (!existsSync(statePath)) {
  ctx.fail(`no state at ${statePath}; run /review first`, EXIT_NOT_FOUND);
}

const rejectedPath = path.resolve(ctx.root, 'docs/review/REJECTED.md');
if (!existsSync(rejectedPath)) {
  ctx.fail(`no REJECTED.md at ${rejectedPath}`, EXIT_NOT_FOUND);
}

const state = JSON.parse(readFileSync(statePath, 'utf8'));
const entry = state[axis];
if (!entry) {
  const known = Object.keys(state).join(', ') || '(none)';
  ctx.fail(`no state for axis "${axis}"; known: ${known}`, EXIT_NOT_FOUND);
}

// Reuse the canonical heading parser instead of re-implementing the
// `## R<NN> — slug` shape here — two copies of the em-dash grammar would
// Drift independently.
const lib = await ctx.loadLib('scripts/review/lib/ctx.ts');
const rejectedSlugs = new Set(
  lib.parseRejected(readFileSync(rejectedPath, 'utf8')).map((re) => re.slug.toLowerCase()),
);

let findings = [];
if (Array.isArray(entry.findings)) {
  ({ findings } = entry);
}
const total = findings.length;
const overlap = findings.filter((finding) =>
  rejectedSlugs.has(String(finding.id ?? '').toLowerCase()),
).length;
let overlapRate = EMPTY_COUNT;
if (total > EMPTY_COUNT) {
  overlapRate = overlap / total;
}

let cleanRunCount = EMPTY_COUNT;
if (Number.isInteger(entry.clean_run_count)) {
  cleanRunCount = entry.clean_run_count;
}
const lastVerdict = entry.round_verdict;

// Compose the cross-run status (the answer to "is this axis done?"). The
// Orchestrator computes the same thing in SKILL.md Step 9 — this script
// Exposes it for direct inspection without re-running /review.
let status = 'open';
if (cleanRunCount >= CONVERGENCE_THRESHOLD) {
  status = 'converged';
} else if (lastVerdict === 'overlap-stop') {
  status = 'non-converging';
} else if (cleanRunCount === CONFIRMATION_COUNT) {
  status = 'clean-1-of-2-pending-confirmation';
}

const headSha = entry.head_sha;

process.stdout.write(
  `${JSON.stringify(
    {
      axis,
      clean_run_count: cleanRunCount,
      head_sha: headSha,
      overlap_rate: overlapRate,
      overlap_with_rejected: overlap,
      rejected_slugs_loaded: rejectedSlugs.size,
      round_verdict: lastVerdict,
      status,
      total_findings: total,
    },
    JSON_REPLACER,
    JSON_INDENT,
  )}\n`,
);
