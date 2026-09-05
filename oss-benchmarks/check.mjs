#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { checkCoverage, fetchSnapshotLocal, REPOS_DIR } from './coverage.ts';

const snapshotPath = new URL('./snapshots.json', import.meta.url);
try {
  const { values, tokens } = parseArgs({
    options: { update: { type: 'boolean' }, local: { type: 'boolean' } },
    tokens: true,
  });
  if (tokens.length > 1) throw new Error('Use either --update or --local, once.');
  let snapshot;
  if (values.update || values.local) {
    const local = fetchSnapshotLocal(REPOS_DIR);
    for (const project of local.skipped) console.error(`No local config: ${project}`);
    snapshot = local.snapshot;
  } else snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));

  const result = checkCoverage(snapshot);
  if (values.update) writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  for (const hit of result.backlogHits)
    console.error(`Backlog: ${hit.project}/${hit.file}: ${hit.key} — ${hit.reason}`);
  for (const gap of result.gaps)
    console.error(`Unclassified: ${gap.project}/${gap.file}: ${gap.keys.join(', ')}`);
  console.log(
    `OSS coverage: ${result.checked} configs checked; ${result.gaps.length} gaps (snapshot: ${snapshot.updatedAt}).`,
  );
  if (result.gaps.length) process.exitCode = 1;
} catch (error) {
  console.error(`OSS coverage: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
