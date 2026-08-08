#!/usr/bin/env node
// CLI surface for `/review` ledger access. Pure parsing lives in
// scripts/review/lib/ctx.ts; this driver argparses, reads files, prints
// JSON / raw text. Exit codes: 0 success, 1 not-found, 2 usage error.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createScriptContext } from '../_shared/script-runtime.mjs';
import path from 'node:path';

const ctx = createScriptContext(import.meta.url);

const NOT_FOUND = -1;
const FLAG_VALUE_OFFSET = 1;
const ARGV_SLICE_START = 2;
const SUB_INDEX = 1;
const EXIT_NOT_FOUND = 1;
const EXIT_USAGE = 2;
const STDIN_FD = 0;
const JSON_INDENT = 2;
const JSON_REPLACER = (_key, val) => val;

const LEDGER_PATHS = {
  axes: 'docs/review/AXES.md',
  decisions: 'docs/review/DECISIONS.md',
  rejected: 'docs/review/REJECTED.md',
};

const USAGE = `usage:
  # Read side
  ctx ledger slugs --kind <rejected|decisions|axes>
  ctx ledger get   --kind <rejected|decisions|axes> --id <R01|slug>
  ctx axis  brief  --name <axis>
  ctx canon                   # full TDD-CANON.md (no parsing)
  ctx state get    --axis <axis>
  ctx state list
  ctx observations recent [--since <YYYY-MM-DD>] [--axis <axis>]
  ctx observations get    --slug <slug>
  # Write side
  ctx ledger append --kind <rejected|decisions> --title <t> [--path <abs>]
      (body read from stdin; assigned id printed to stdout)
  ctx observations append --axis <a> --slug <s> --date <d> [--file <ref>] [--path <abs>]
      (note body read from stdin)
  ctx state set --axis <a> [--path <abs>]
      (JSON entry read from stdin)`;

const takeFlag = (args, name) => {
  const idx = args.indexOf(name);
  if (idx === NOT_FOUND || idx + FLAG_VALUE_OFFSET >= args.length) {
    return;
  }
  const value = args[idx + FLAG_VALUE_OFFSET];
  // `--slug --date 2026-01-01` (value omitted) would otherwise return
  // '--date' as the slug and write it verbatim into a ledger heading;
  // Treat a flag-shaped token as a missing value so the required-flag
  // Checks fire instead.
  if (value.startsWith('--')) {
    return;
  }
  return value;
};

const readLedger = (kind) => {
  const rel = LEDGER_PATHS[kind];
  if (!rel) {
    ctx.fail(`unknown ledger kind: ${kind} (expected rejected|decisions|axes)`, EXIT_USAGE);
  }
  return readFileSync(path.join(ctx.root, rel), 'utf8');
};

const loadCtxLib = () => ctx.loadLib('scripts/review/lib/ctx.ts');

try {
  const args = process.argv.slice(ARGV_SLICE_START);
  const [cmd] = args;
  const sub = args[SUB_INDEX];

  if (cmd === 'ledger' && sub === 'slugs') {
    const kind = takeFlag(args, '--kind');
    const md = readLedger(kind);
    const lib = await loadCtxLib();
    let entries = [];
    if (kind === 'rejected') {
      entries = lib.parseRejected(md);
    } else if (kind === 'decisions') {
      entries = lib.parseDecisions(md);
    } else {
      entries = lib.parseAxes(md);
    }
    process.stdout.write(`${JSON.stringify(entries, JSON_REPLACER, JSON_INDENT)}\n`);
  } else if (cmd === 'ledger' && sub === 'get') {
    const kind = takeFlag(args, '--kind');
    const id = takeFlag(args, '--id');
    if (!id) {
      ctx.fail('ledger get: --id is required', EXIT_USAGE);
    }
    const md = readLedger(kind);
    const lib = await loadCtxLib();
    const entry = lib.getEntryById(md, { id, kind });
    if (typeof entry === 'undefined') {
      ctx.fail(`no entry with id "${id}" in ${kind}`, EXIT_NOT_FOUND);
    }
    process.stdout.write(entry);
  } else if (cmd === 'canon') {
    // TDD-CANON has irregular heading structure (mixed `##` titles and
    // `### V<N>` deviation subsections) so the CLI returns the whole
    // File rather than per-section slicing. Cheaper than parsing and
    // Still bounded — the file is <12K.
    const canonPath = path.join(ctx.root, 'docs/review/TDD-CANON.md');
    if (!existsSync(canonPath)) {
      ctx.fail(`no canon at ${canonPath}`, EXIT_NOT_FOUND);
    }
    process.stdout.write(readFileSync(canonPath, 'utf8'));
  } else if (cmd === 'axis' && sub === 'brief') {
    const name = takeFlag(args, '--name');
    if (!name) {
      ctx.fail('axis brief: --name is required', EXIT_USAGE);
    }
    const axisPath = path.join(ctx.root, '.claude/agents/axes', `${name}.md`);
    if (!existsSync(axisPath)) {
      ctx.fail(`no axis brief for "${name}" at ${axisPath}`, EXIT_NOT_FOUND);
    }
    process.stdout.write(readFileSync(axisPath, 'utf8'));
  } else if (cmd === 'state' && sub === 'get') {
    const axis = takeFlag(args, '--axis');
    if (!axis) {
      ctx.fail('state get: --axis is required', EXIT_USAGE);
    }
    const statePath = path.join(ctx.root, '.claude/state/review-last-findings.json');
    if (!existsSync(statePath)) {
      ctx.fail(`no state file at ${statePath}`, EXIT_NOT_FOUND);
    }
    const lib = await loadCtxLib();
    const entry = lib.getStateForAxis(readFileSync(statePath, 'utf8'), axis);
    if (typeof entry === 'undefined') {
      ctx.fail(`no state for axis "${axis}"`, EXIT_NOT_FOUND);
    }
    process.stdout.write(`${JSON.stringify(entry, JSON_REPLACER, JSON_INDENT)}\n`);
  } else if (cmd === 'state' && sub === 'list') {
    const statePath = path.join(ctx.root, '.claude/state/review-last-findings.json');
    if (!existsSync(statePath)) {
      ctx.fail(`no state file at ${statePath}`, EXIT_NOT_FOUND);
    }
    const lib = await loadCtxLib();
    process.stdout.write(
      `${JSON.stringify(lib.listStateAxes(readFileSync(statePath, 'utf8')), JSON_REPLACER, JSON_INDENT)}\n`,
    );
  } else if (cmd === 'observations' && sub === 'recent') {
    const since = takeFlag(args, '--since');
    const axisFilter = takeFlag(args, '--axis');
    const pathOverride = takeFlag(args, '--path');
    const target = pathOverride ?? path.join(ctx.root, 'docs/review/OBSERVATIONS.md');
    if (existsSync(target)) {
      const lib = await loadCtxLib();
      let entries = lib.parseObservations(readFileSync(target, 'utf8'));
      if (typeof since !== 'undefined') {
        entries = entries.filter((entry) => entry.date >= since);
      }
      if (typeof axisFilter !== 'undefined') {
        entries = entries.filter((entry) => entry.axis === axisFilter);
      }
      process.stdout.write(`${JSON.stringify(entries, JSON_REPLACER, JSON_INDENT)}\n`);
    } else {
      process.stdout.write('[]\n');
    }
  } else if (cmd === 'observations' && sub === 'get') {
    const slug = takeFlag(args, '--slug');
    const pathOverride = takeFlag(args, '--path');
    if (!slug) {
      ctx.fail('observations get: --slug is required', EXIT_USAGE);
    }
    const target = pathOverride ?? path.join(ctx.root, 'docs/review/OBSERVATIONS.md');
    if (!existsSync(target)) {
      ctx.fail(`no observations file at ${target}`, EXIT_NOT_FOUND);
    }
    const lib = await loadCtxLib();
    const entry = lib.getObservationBySlug(readFileSync(target, 'utf8'), slug);
    if (typeof entry === 'undefined') {
      ctx.fail(`no observation with slug "${slug}"`, EXIT_NOT_FOUND);
    }
    process.stdout.write(entry);
  } else if (cmd === 'observations' && sub === 'append') {
    const axis = takeFlag(args, '--axis');
    const slug = takeFlag(args, '--slug');
    const date = takeFlag(args, '--date');
    const fileRef = takeFlag(args, '--file');
    const pathOverride = takeFlag(args, '--path');
    if (!axis || !slug || !date) {
      ctx.fail('observations append: --axis, --slug, --date are required', EXIT_USAGE);
    }
    const note = readFileSync(STDIN_FD, 'utf8');
    if (note.trim() === '') {
      ctx.fail('observations append: stdin (note body) is required', EXIT_USAGE);
    }
    const lib = await loadCtxLib();
    const entry = lib.formatObservationEntry({
      axis,
      date,
      file: fileRef,
      note,
      slug,
    });
    const target = pathOverride ?? path.join(ctx.root, 'docs/review/OBSERVATIONS.md');
    let current = '';
    if (existsSync(target)) {
      current = readFileSync(target, 'utf8');
    }
    // Read-modify-write because appendObservation owns the blank-line
    // Separator policy. Concurrent appends would race, but the /review
    // Skill is sequential by design — Step 7.5 fires once per round
    // After triage and never in parallel with another round. Atomic
    // Temp+rename so a crash mid-append can't truncate the (load-bearing)
    // Observations log — same guarantee as the ledger / state writes.
    mkdirSync(path.dirname(target), { recursive: true });
    const tempPath = `${target}.tmp-${process.pid}`;
    writeFileSync(tempPath, lib.appendObservation(current, entry));
    renameSync(tempPath, target);
    process.stdout.write(`${target}\n`);
  } else if (cmd === 'ledger' && sub === 'append') {
    const kind = takeFlag(args, '--kind');
    const title = takeFlag(args, '--title');
    const pathOverride = takeFlag(args, '--path');
    if (kind !== 'rejected' && kind !== 'decisions') {
      ctx.fail('ledger append: --kind must be rejected or decisions', EXIT_USAGE);
    }
    if (!title) {
      ctx.fail('ledger append: --title is required', EXIT_USAGE);
    }
    const body = readFileSync(STDIN_FD, 'utf8');
    if (body.trim() === '') {
      ctx.fail('ledger append: stdin (entry body) is required', EXIT_USAGE);
    }
    const target = pathOverride ?? path.join(ctx.root, LEDGER_PATHS[kind]);
    let current = '';
    if (existsSync(target)) {
      current = readFileSync(target, 'utf8');
    }
    const lib = await loadCtxLib();
    const id = lib.nextLedgerId(current, kind);
    const entry = lib.formatLedgerEntry({ body, id, kind, title });
    // Atomic write so a crash mid-append cannot truncate a load-bearing
    // Ledger. Same pattern as state set.
    const next = lib.appendLedgerEntry(current, entry);
    mkdirSync(path.dirname(target), { recursive: true });
    const tempPath = `${target}.tmp-${process.pid}`;
    writeFileSync(tempPath, next);
    renameSync(tempPath, target);
    process.stdout.write(`${id}\n`);
  } else if (cmd === 'state' && sub === 'set') {
    const axis = takeFlag(args, '--axis');
    const pathOverride = takeFlag(args, '--path');
    if (!axis) {
      ctx.fail('state set: --axis is required', EXIT_USAGE);
    }
    const payload = readFileSync(STDIN_FD, 'utf8');
    if (payload.trim() === '') {
      ctx.fail('state set: stdin (JSON entry) is required', EXIT_USAGE);
    }
    let entryObj = {};
    try {
      entryObj = JSON.parse(payload);
    } catch (error) {
      let errorMsg = String(error);
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      ctx.fail(`state set: stdin is not valid JSON — ${errorMsg}`, EXIT_USAGE);
    }
    const target = pathOverride ?? path.join(ctx.root, '.claude/state/review-last-findings.json');
    let current = '{}';
    if (existsSync(target)) {
      current = readFileSync(target, 'utf8');
    }
    const lib = await loadCtxLib();
    const next = lib.updateState(current, axis, entryObj);
    // `.claude/state/` is gitignored, so a fresh clone has no directory to
    // Rename into — without the mkdir, the very first round's state write
    // Dies on ENOENT. The other two write paths carry the same guard for
    // Their `--path <override>` case.
    mkdirSync(path.dirname(target), { recursive: true });
    // Atomic write via tempfile + rename so a crash between the read
    // And the write cannot leave the state file truncated. POSIX
    // Rename is atomic within the same filesystem; the temp sibling
    // Guarantees that.
    const tempPath = `${target}.tmp-${process.pid}`;
    writeFileSync(tempPath, next);
    renameSync(tempPath, target);
    process.stdout.write(`${target}\n`);
  } else {
    ctx.fail(USAGE, EXIT_USAGE);
  }
} catch (error) {
  ctx.fail(error);
}
