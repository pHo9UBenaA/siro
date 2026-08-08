#!/usr/bin/env node
// Deterministic gates the /review skill runs before any LLM reviewer.
// Findings whose root cause shows up here MUST be dropped at triage —
// See .claude/skills/review/SKILL.md Step 4 and AXES.md "static-gate".

import { createScriptContext } from '../_shared/script-runtime.mjs';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ctx = createScriptContext(import.meta.url);

const TAIL_BYTES = 4096;
const BUFFER_MULTIPLIER = 2;
const EXIT_SUCCESS = 0;
const EXIT_ISSUES = 1;
const FALLBACK_EXIT = -1;
const JSON_INDENT = 2;
const JSON_REPLACER = (_key, val) => val;
const TRIMMED_EMPTY = 0;
const { findMissingReviewAssets } = await ctx.loadLib('scripts/review/lib/preflight-assets.ts');

const missingAssets = findMissingReviewAssets((relativePath) =>
  existsSync(path.join(ctx.root, relativePath)),
);
if (missingAssets.length > TRIMMED_EMPTY) {
  process.stdout.write(
    `${JSON.stringify({ missing_review_assets: missingAssets, ok: false }, JSON_REPLACER, JSON_INDENT)}\n`,
  );
  ctx.fail('required review assets are missing', EXIT_ISSUES);
}

/**
 * Build the error message for a spawn failure.
 */
const formatSpawnError = (error) => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/**
 * Handle the spawn error event.
 */
const handleSpawnError = ({ err, opts, resolve, startedAt }) => {
  /** @type {NodeJS.ErrnoException} */
  const errnoErr = err;
  const enoent = errnoErr.code === 'ENOENT';
  // `ok` and `status` must agree: a gate is either skipped (optional
  // Binary genuinely absent) or failed — `ok: true` with status 'fail'
  // Would let overallOk pass while the JSON shows a failing gate.
  const skipped = opts.optional === true && enoent;
  let status = 'fail';
  if (skipped) {
    status = 'skipped';
  }
  resolve({
    duration_ms: Date.now() - startedAt,
    ok: skipped,
    status,
    tail: `spawn error: ${err.message}`,
  });
};

/**
 * Build the result for a successful gate.
 */
const buildPassResult = ({ duration_ms, opts, stdout }) => {
  const passResult = { duration_ms, exit_code: EXIT_SUCCESS, ok: true, status: 'pass' };
  if (opts.informational) {
    passResult.stdout = stdout;
  }
  return passResult;
};

/**
 * Build the result for a failed gate.
 */
const buildFailResult = ({ code, duration_ms, stderr, stdout }) => {
  let captured = stderr;
  if (stderr.trim().length <= TRIMMED_EMPTY) {
    captured = stdout;
  }
  return {
    duration_ms,
    exit_code: code ?? FALLBACK_EXIT,
    ok: false,
    status: 'fail',
    tail: captured.slice(-TAIL_BYTES),
  };
};

/**
 * Handle the child process close event.
 */
const handleClose = ({ code, opts, resolve, startedAt, stderr, stdout }) => {
  const duration_ms = Date.now() - startedAt;
  if (code === EXIT_SUCCESS) {
    resolve(buildPassResult({ duration_ms, opts, stdout }));
  } else if (opts.informational && code === EXIT_ISSUES && stdout.trim().length > TRIMMED_EMPTY) {
    resolve({ duration_ms, exit_code: EXIT_ISSUES, ok: true, status: 'pass', stdout });
  } else {
    resolve(buildFailResult({ code, duration_ms, stderr, stdout }));
  }
};

/**
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ optional?: boolean, informational?: boolean }} [opts]
 * @returns {Promise<{ ok: boolean, status: 'pass'|'fail'|'skipped', duration_ms: number, exit_code?: number, stdout?: string, tail?: string }>}
 */
/**
 * Attempt to spawn a child process. Returns the child or a sync-failure result.
 */
const trySpawn = (cmd, args) => {
  try {
    return { child: spawn(cmd, args, { cwd: ctx.root, env: process.env }) };
  } catch (error) {
    return {
      failure: {
        duration_ms: 0,
        ok: false,
        status: 'fail',
        tail: `spawn failed: ${formatSpawnError(error)}`,
      },
    };
  }
};

/**
 * Wire up stdout/stderr buffering on the child process.
 */
const wireBuffering = (child, capStdout) => {
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString('utf8');
    if (capStdout && stdout.length > TAIL_BYTES * BUFFER_MULTIPLIER) {
      stdout = stdout.slice(-TAIL_BYTES * BUFFER_MULTIPLIER);
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8');
    if (stderr.length > TAIL_BYTES * BUFFER_MULTIPLIER) {
      stderr = stderr.slice(-TAIL_BYTES * BUFFER_MULTIPLIER);
    }
  });
  return { getStderr: () => stderr, getStdout: () => stdout };
};

const runGate = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const spawned = trySpawn(cmd, args);
    if (spawned.failure) {
      resolve(spawned.failure);
      return;
    }
    const { child } = spawned;
    const buf = wireBuffering(child, !opts.informational);
    child.on('error', (err) => {
      handleSpawnError({ err, opts, resolve, startedAt });
    });
    child.on('close', (code) => {
      handleClose({
        code,
        opts,
        resolve,
        startedAt,
        stderr: buf.getStderr(),
        stdout: buf.getStdout(),
      });
    });
  });

const gates = [
  { args: ['typecheck'], cmd: 'pnpm', key: 'typecheck', label: 'typecheck' },
  { args: ['test'], cmd: 'pnpm', key: 'test', label: 'test' },
  { args: ['exec', 'oxlint', '--deny-warnings'], cmd: 'pnpm', key: 'oxlint', label: 'oxlint' },
  { args: ['exec', 'oxfmt', '--check'], cmd: 'pnpm', key: 'oxfmt', label: 'oxfmt' },
  {
    args: ['exec', 'knip', '--reporter', 'json', '--no-progress'],
    cmd: 'pnpm',
    informational: true,
    key: 'knip',
    label: 'knip',
    optional: true,
  },
  {
    // Informational scan that feeds the comment-rot axis a deterministic
    // List of >=10-line JSDoc blocks. Without this, the LLM reviewer
    // Tended to stop after the first hit; with it, every long block has
    // To be visited and triaged.
    args: ['scripts/review/lib/scan-long-comments.mjs'],
    cmd: 'node',
    informational: true,
    key: 'long_comments',
    label: 'long-comments',
  },
  {
    // Informational inventory of every test/**/*.test.ts file with
    // Per-file shape metrics (it/describe counts, toMatchObject
    // Density, mock-assertion presence, internal-layer imports).
    // Feeds test-brittleness and tdd-discipline so each axis visits
    // Every file rather than stopping at the first hit.
    args: ['scripts/review/lib/scan-test-inventory.mjs'],
    cmd: 'node',
    informational: true,
    key: 'test_inventory',
    label: 'test-inventory',
  },
];

/**
 * Run all gates sequentially, returning a results map.
 * Uses promise chaining (not await-in-loop or async function).
 */
const runAllGates = (gateList) => {
  const results = {};
  let chain = Promise.resolve();
  for (const gate of gateList) {
    chain = chain.then(() => {
      process.stderr.write(`preflight: ${gate.label} … `);
      return runGate(gate.cmd, gate.args, {
        informational: gate.informational,
        optional: gate.optional,
      }).then((res) => {
        results[gate.key] = res;
        process.stderr.write(`${res.status} (${res.duration_ms}ms)\n`);
      });
    });
  }
  return chain.then(() => results);
};

const results = await runAllGates(gates);

const overallOk = Object.values(results).every((result) => result.ok);

process.stdout.write(
  `${JSON.stringify({ gates: results, ok: overallOk }, JSON_REPLACER, JSON_INDENT)}\n`,
);

if (!overallOk) {
  ctx.fail('one or more gates failed; see JSON on stdout for details', EXIT_ISSUES);
}
