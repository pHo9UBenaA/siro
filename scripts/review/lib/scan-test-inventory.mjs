// Lists every test file under test/ with per-file shape metrics, so the
// /review test-brittleness and tdd-discipline axes can visit each entry
// Instead of stopping at the first hit. Output: JSON `{ files: [...] }`
// On stdout — consumed by scripts/review/preflight.mjs the same way
// Knip is.
//
// The metrics are signals, not findings. They flag candidates the
// Reviewer must judge: e.g. high `toMatchObject` density is a V3
// Candidate, but only the reviewer decides whether each `it` block is
// Actually a stack of pins or N distinct invariants.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveRoot } from '../../_shared/script-runtime.mjs';

const repoRoot = resolveRoot(import.meta.url);
const testRoot = path.join(repoRoot, 'test');

const MATCH_OBJECT_THRESHOLD = 4;
const MOCK_ASSERTION_THRESHOLD = 0;
const IT_COUNT_THRESHOLD = 0;
const HIGH_ASSERTION_DENSITY = 4;
const INTERNAL_IMPORT_THRESHOLD = 2;
const INVOKED_PATH_INDEX = 1;
const EMPTY_MATCH = 0;

const INTERNAL_IMPORT_RE =
  /from ['"](?:\.\.\/)+src\/(?:domain\/services|domain\/schemas|adapters\/codecs\/_|shared)\//gu;

const walk = (dir) => {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
};

const countMatches = (text, pattern) => {
  const matches = text.match(pattern);
  if (matches) {
    return matches.length;
  }
  return EMPTY_MATCH;
};

/**
 * Compute shape metrics for a single test file.
 */
const computeMetrics = (text) => {
  const describeCount = countMatches(text, /^\s*describe\(/gmu);
  const itCount = countMatches(text, /^\s*it\(/gmu);
  const matchObject = countMatches(text, /toMatchObject\(/gu);
  const toHaveBeenCalled = countMatches(text, /toHaveBeenCalled/gu);
  const expectCalls = countMatches(text, /\bexpect\(/gu);
  const beforeEach = countMatches(text, /\bbeforeEach\(/gu);
  const internalImports = countMatches(text, INTERNAL_IMPORT_RE);
  const moduleTopCtx = /^(?:const|let)\s+ctx\s*=\s*makeCtx\(/mu.test(text);
  const readsRealSource = /readFileSync\(.*src\//u.test(text);
  return {
    beforeEach,
    describeCount,
    expectCalls,
    internalImports,
    itCount,
    matchObject,
    moduleTopCtx,
    readsRealSource,
    toHaveBeenCalled,
  };
};

/**
 * Check structural flags (V-candidates, mock-assertion, ctx shape).
 */
const checkStructuralFlags = (metrics, flags) => {
  if (metrics.matchObject >= MATCH_OBJECT_THRESHOLD) {
    flags.push('V3-candidate: stacked toMatchObject');
  }
  if (metrics.toHaveBeenCalled > MOCK_ASSERTION_THRESHOLD) {
    flags.push('mock-assertion: toHaveBeenCalled present');
  }
  if (metrics.moduleTopCtx) {
    flags.push('V4-candidate: module-top ctx');
  }
  if (metrics.readsRealSource) {
    flags.push('V2-candidate: reads real src/ file');
  }
};

/**
 * Check density / import flags.
 */
const checkDensityFlags = (metrics, flags) => {
  if (
    metrics.itCount > IT_COUNT_THRESHOLD &&
    metrics.expectCalls / metrics.itCount >= HIGH_ASSERTION_DENSITY
  ) {
    flags.push(
      `assertion-density: ${(metrics.expectCalls / metrics.itCount).toFixed(INVOKED_PATH_INDEX)} expect()/it()`,
    );
  }
  if (metrics.internalImports >= INTERNAL_IMPORT_THRESHOLD) {
    flags.push(`internal-imports: ${metrics.internalImports} hits`);
  }
};

/**
 * Derive flag annotations from metrics.
 */
const deriveFlags = (metrics) => {
  /** @type {string[]} */
  const flags = [];
  checkStructuralFlags(metrics, flags);
  checkDensityFlags(metrics, flags);
  return flags;
};

const scanFile = (absPath) => {
  const text = readFileSync(absPath, 'utf8');
  const metrics = computeMetrics(text);
  const flags = deriveFlags(metrics);
  const result = Object.assign(metrics, {
    file: path.relative(repoRoot, absPath),
    flags,
  });
  return result;
};

// Run the driver only when invoked directly. The sibling scan-long-comments
// Guards this for the same reason: importing the module must not walk the
// Whole test/ tree and dump JSON to stdout. pathToFileURL (not a raw `file://`
// Concat) matches the cli.ts bootstrap and survives Windows paths / spaces.
const invokedPath = process.argv[INVOKED_PATH_INDEX];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  const files = [];
  try {
    statSync(testRoot);
    for (const tf of walk(testRoot)) {
      files.push(scanFile(tf));
    }
  } catch {
    // Test/ absent — emit empty
  }

  files.sort((left, right) => right.flags.length - left.flags.length);

  process.stdout.write(`${JSON.stringify({ files })}\n`);
}
