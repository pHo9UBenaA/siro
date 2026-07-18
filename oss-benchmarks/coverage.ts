import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BACKLOG, COVERED, EXCLUDED } from './covered-keys.ts';
import { projects } from './projects.ts';
import type { CodecKind, ParsedConfig } from '../src/domain/entities/config-value.ts';
import { codecFor } from '../src/adapters/codecs/store.ts';

export type { OssProject } from './projects.ts';
export { projects } from './projects.ts';

// ---------------------------------------------------------------------------
// Snapshot schema
// ---------------------------------------------------------------------------

export interface SnapshotEntry {
  readonly project: string;
  readonly file: string;
  readonly codecKind: CodecKind;
  readonly content: string;
}

export interface Snapshot {
  readonly formatVersion?: number;
  readonly updatedAt: string;
  readonly projectCount?: number;
  readonly entries: readonly SnapshotEntry[];
}

export const REPOS_DIR = path.join(import.meta.dirname ?? '', 'repos');

// ---------------------------------------------------------------------------
// Read config files from locally cloned repos.
// Returns the snapshot and the list of projects skipped (no clone found).
// ---------------------------------------------------------------------------

const readProjectEntries = (
  reposDir: string,
  project: (typeof projects)[number],
): SnapshotEntry[] => {
  const projectDir = path.join(reposDir, project.name);
  const entries: SnapshotEntry[] = [];

  for (const cf of project.configFiles) {
    const filePath = path.join(projectDir, cf.path);
    if (existsSync(filePath)) {
      entries.push({
        codecKind: cf.codecKind,
        content: readFileSync(filePath, 'utf8'),
        file: cf.path,
        project: project.name,
      });
    }
  }

  return entries;
};

export const fetchSnapshotLocal = (reposDir: string): { snapshot: Snapshot; skipped: string[] } => {
  const entries: SnapshotEntry[] = [];
  const skipped: string[] = [];

  for (const project of projects) {
    const projectEntries = readProjectEntries(reposDir, project);
    if (projectEntries.length > 0) {
      entries.push(...projectEntries);
    } else {
      skipped.push(project.name);
    }
  }

  return {
    skipped,
    snapshot: {
      entries,
      formatVersion: 1,
      projectCount: entries.length,
      updatedAt: new Date().toISOString(),
    },
  };
};

// ---------------------------------------------------------------------------
// Key extraction
// ---------------------------------------------------------------------------

export const extractKeys = (parsed: ParsedConfig, kind: CodecKind): string[] => {
  if (kind === 'toml') {
    const keys: string[] = [];
    for (const [section, value] of Object.entries(parsed)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        for (const subKey of Object.keys(value)) {
          keys.push(`${section}.${subKey}`);
        }
      } else {
        keys.push(section);
      }
    }
    return keys;
  }
  return Object.keys(parsed);
};

// ---------------------------------------------------------------------------
// Check coverage against a saved snapshot
// ---------------------------------------------------------------------------

export interface CoverageGap {
  readonly project: string;
  readonly file: string;
  readonly keys: string[];
}

export interface BacklogHit {
  readonly project: string;
  readonly file: string;
  readonly key: string;
  readonly reason: string;
}

export interface CoverageResult {
  readonly gaps: CoverageGap[];
  readonly backlogHits: BacklogHit[];
  readonly checked: number;
}

interface EntryLookups {
  readonly covered: ReadonlySet<string>;
  readonly excluded: ReadonlySet<string>;
  readonly backlogMap: ReadonlyMap<string, string>;
}

const buildEntryLookups = (entry: SnapshotEntry): EntryLookups => ({
  backlogMap: new Map((BACKLOG[entry.file] ?? []).map((bl) => [bl.key, bl.reason])),
  covered: COVERED[entry.file] ?? new Set<string>(),
  excluded: EXCLUDED[entry.file] ?? new Set<string>(),
});

const classifyKey = (
  key: string,
  entry: SnapshotEntry,
  ctx: {
    readonly backlogHits: BacklogHit[];
    readonly lookups: EntryLookups;
    readonly uncovered: string[];
  },
): void => {
  if (ctx.lookups.covered.has(key) || ctx.lookups.excluded.has(key)) {
    return;
  }
  const reason = ctx.lookups.backlogMap.get(key);
  if (typeof reason === 'undefined') {
    ctx.uncovered.push(key);
  } else {
    ctx.backlogHits.push({ file: entry.file, key, project: entry.project, reason });
  }
};

const processEntry = (
  entry: SnapshotEntry,
  results: { readonly backlogHits: BacklogHit[]; readonly gaps: CoverageGap[] },
): void => {
  const parsed = codecFor(entry.codecKind).parse(entry.content);
  const keys = extractKeys(parsed, entry.codecKind);
  const lookups = buildEntryLookups(entry);
  const uncovered: string[] = [];

  const classifyCtx = { backlogHits: results.backlogHits, lookups, uncovered };
  for (const key of keys) {
    classifyKey(key, entry, classifyCtx);
  }

  const EMPTY = 0;
  if (uncovered.length > EMPTY) {
    results.gaps.push({ file: entry.file, keys: uncovered, project: entry.project });
  }
};

export const checkCoverage = (snapshot: Snapshot): CoverageResult => {
  const gaps: CoverageGap[] = [];
  const backlogHits: BacklogHit[] = [];
  let checked = 0;

  const results = { backlogHits, gaps };
  for (const entry of snapshot.entries) {
    const INCREMENT = 1;
    checked += INCREMENT;
    processEntry(entry, results);
  }

  return { backlogHits, checked, gaps };
};
