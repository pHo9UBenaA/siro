// Lists every block comment (`/* … */`, `/** … */`) and `//`-run of
// >= MIN_LINES lines under src/ and
// Each scripts/<ctx>/lib/, so the /review comment-rot axis can triage
// Each entry instead of stopping at the first hit. Output: JSON
// `{ blocks: [...] }` on stdout — consumed by scripts/review/preflight.mjs
// The same way knip is.
//
// Why not write this in TS? It runs under the same .mjs driver fleet
// As preflight and never needs a jiti bootstrap; keeping it .mjs lets
// Preflight invoke it directly without the type-side detour.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRoot } from '../../_shared/script-runtime.mjs';

const repoRoot = resolveRoot(import.meta.url);

const MIN_LINES = 10;
const BLOCK_OPEN_OFFSET = 2;
const NO_INDEX = -1;
const HEADING_OFFSET = 1;
const INDEX_STEP = 1;
const ROOTS = [
  'src',
  // The whole scripts/ tree, drivers included: layers.mjs / preflight.mjs /
  // Gen/rule.mjs carry >=10-line header comments that fall under comment-rot
  // Exactly like the lib/ helpers — the comment-rot axis brief's own
  // Suggested-fix example targets a driver header, so excluding drivers made
  // The "visit every entry" contract unsatisfiable for those blocks.
  'scripts',
];
const EXTS = ['.ts', '.mjs', '.d.mts'];

const walk = (dir) => {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (EXTS.some((ext) => full.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
};

/**
 * Push a block if it meets the minimum line threshold.
 */
const pushIfLong = ({ blocks, lines, from, toExclusive }) => {
  const lineCount = toExclusive - from;
  if (lineCount >= MIN_LINES) {
    blocks.push({
      content: lines.slice(from, toExclusive).join('\n'),
      endLine: toExclusive,
      lineCount,
      startLine: from + HEADING_OFFSET,
    });
  }
};

/**
 * End a pending `//` run and push it if long enough.
 */
const endSlashRun = ({ blocks, lines, slashStart, toExclusive }) => {
  if (slashStart !== NO_INDEX) {
    pushIfLong({ blocks, from: slashStart, lines, toExclusive });
  }
};

const CLOSE_BLOCK_RE = /\*\//u;

/**
 * Handle a block-comment opener (`/*`), ending any pending `//` run.
 * Returns the new `start` value.
 */
const handleBlockOpen = (ctx) => {
  const { blocks, idx, line, lines, openIdx } = ctx;
  endSlashRun({ blocks, lines, slashStart: ctx.slashStart, toExclusive: idx });
  // A one-line `/* … */` must not leave `start` dangling, otherwise
  // The next unrelated `*/` would pair with it and produce a phantom
  // Block spanning the code between the two markers.
  if (line.includes('*/', openIdx + BLOCK_OPEN_OFFSET)) {
    return NO_INDEX;
  }
  return idx;
};

/**
 * Handle a `//` line-comment continuation or start.
 */
const handleSlashLine = (slashStart, idx) => {
  if (slashStart === NO_INDEX) {
    return { slashStart: idx, start: NO_INDEX };
  }
  return { slashStart, start: NO_INDEX };
};

/**
 * Process a line when no block comment is open. Handles `/*` openers,
 * `//` run tracking, and non-comment lines. Returns updated
 * `{ start, slashStart }`.
 */
const processOutsideBlock = (ctx) => {
  const { line, idx } = ctx;
  const openIdx = line.indexOf('/*');
  const lineCommentIdx = line.indexOf('//');
  if (openIdx !== NO_INDEX && (lineCommentIdx === NO_INDEX || openIdx < lineCommentIdx)) {
    const start = handleBlockOpen(Object.assign(ctx, { openIdx }));
    return { slashStart: NO_INDEX, start };
  }
  if (line.trimStart().startsWith('//')) {
    return handleSlashLine(ctx.slashStart, idx);
  }
  endSlashRun({
    blocks: ctx.blocks,
    lines: ctx.lines,
    slashStart: ctx.slashStart,
    toExclusive: idx,
  });
  return { slashStart: NO_INDEX, start: NO_INDEX };
};

/**
 * Process a single line of the scanner, returning updated state.
 */
const processLine = ({ blocks, idx, line, lines, slashStart, start }) => {
  if (start === NO_INDEX) {
    return processOutsideBlock({ blocks, idx, line, lines, slashStart });
  }
  if (CLOSE_BLOCK_RE.test(line)) {
    pushIfLong({ blocks, from: start, lines, toExclusive: idx + HEADING_OFFSET });
    return { slashStart, start: NO_INDEX };
  }
  return { slashStart, start };
};

/**
 * Pure scanner over a file's text. Returns every long comment block of
 * `>= MIN_LINES` lines — both JSDoc blocks AND runs of consecutive `//` line
 * comments (so headers like layers.mjs are visited by the comment-rot axis,
 * not just JSDoc). Caller adds the `file` field.
 *
 * @param {string} text
 * @returns {Array<{startLine: number, endLine: number, lineCount: number, content: string}>}
 */
export const parseBlocks = (text) => {
  const lines = text.split('\n');
  const blocks = [];
  let start = NO_INDEX;
  let slashStart = NO_INDEX;
  for (let idx = 0; idx < lines.length; idx += INDEX_STEP) {
    const line = lines[idx] ?? '';
    const result = processLine({ blocks, idx, line, lines, slashStart, start });
    ({ slashStart, start } = result);
  }
  endSlashRun({ blocks, lines, slashStart, toExclusive: lines.length });
  return blocks;
};

const scanFile = (absPath) => {
  const text = readFileSync(absPath, 'utf8');
  const rel = path.relative(repoRoot, absPath);
  return parseBlocks(text).map((block) => Object.assign(block, { file: rel }));
};

// Run the driver only when invoked directly — without this guard, importing
// The file from a test would walk the whole tree and dump JSON to stdout
// During every vitest run. pathToFileURL (not a raw `file://` concat) matches
// The cli.ts bootstrap and survives Windows paths / spaces.
const invokedPath = process.argv[HEADING_OFFSET];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const allBlocks = [];
  for (const root of ROOTS) {
    const abs = path.join(repoRoot, root);
    try {
      statSync(abs);
    } catch {
      // directory absent — skip
    }
    for (const file of walk(abs)) {
      allBlocks.push(...scanFile(file));
    }
  }
  process.stdout.write(`${JSON.stringify({ blocks: allBlocks })}\n`);
}
