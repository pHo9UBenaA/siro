#!/usr/bin/env node
// Check siro's coverage against leading-edge OSS project configs.
//
// Usage:
//   node oss-benchmarks/check.mjs            # check saved snapshot
//   node oss-benchmarks/check.mjs --update   # rebuild snapshot from local clones
//   node oss-benchmarks/check.mjs --local    # check directly from local clones
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createJiti } from 'jiti';

import path from 'node:path';

const dir = import.meta.dirname;
const root = path.join(dir, '..');
const jiti = createJiti(root);
const snapshotPath = path.join(dir, 'snapshots.json');
const isUpdate = process.argv.includes('--update');
const isLocal = process.argv.includes('--local');

const EXIT_FAILURE = 1;
const JSON_INDENT = 2;
const EMPTY = 0;

const fail = (msg) => {
  let text = msg;
  if (msg instanceof Error) {
    text = msg.message;
  }
  process.stderr.write(`check-oss-coverage: ${text}\n`);
  process.exit(EXIT_FAILURE);
};

const skipMsg = (text) => {
  process.stderr.write(`check-oss-coverage: skip — ${text}\n`);
};

try {
  const { checkCoverage, fetchSnapshotLocal, REPOS_DIR } = await jiti.import(
    path.join(dir, 'coverage.ts'),
  );

  const readFromLocal = () => {
    const result = fetchSnapshotLocal(REPOS_DIR);

    for (const skippedName of result.skipped) {
      skipMsg(`no local clone for ${skippedName}`);
    }

    const ALL_SKIPPED = result.snapshot.entries.length === EMPTY;
    if (ALL_SKIPPED) {
      fail(
        'all projects skipped — no local clones found. Set up clones as described in oss-benchmarks/README.md',
      );
    }

    return result.snapshot;
  };

  let snapshot = null;

  if (isUpdate) {
    snapshot = readFromLocal();
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, void 0, JSON_INDENT)}\n`);
    process.stdout.write(
      `Snapshot updated (${snapshot.entries.length} entries, ${snapshot.updatedAt}).\n`,
    );
  } else if (isLocal) {
    snapshot = readFromLocal();
  } else {
    if (!existsSync(snapshotPath)) {
      fail('No snapshot found. Run with --update first.');
    }
    snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  }

  const result = checkCoverage(snapshot);

  if (result.backlogHits.length > EMPTY) {
    process.stderr.write('\nBacklog (security-relevant, not yet covered by siro):\n');
    for (const hit of result.backlogHits) {
      process.stderr.write(`  ${hit.file} → ${hit.key}: ${hit.reason}\n`);
    }
    process.stderr.write('\n');
  }

  if (result.gaps.length > EMPTY) {
    const lines = result.gaps.map(
      (gap) => `  ${gap.project} (${gap.file}): ${gap.keys.join(', ')}`,
    );
    fail(
      [
        'Uncovered config keys found. Add a siro rule (→ COVERED), mark as non-security (→ EXCLUDED), or track as future work (→ BACKLOG):',
        '',
        ...lines,
      ].join('\n'),
    );
  }

  process.stdout.write(
    `OSS coverage: ${result.checked} configs checked, no gaps (snapshot: ${snapshot.updatedAt}).\n`,
  );
} catch (error) {
  fail(error);
}
