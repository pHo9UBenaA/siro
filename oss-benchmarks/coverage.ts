import * as vb from 'valibot';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { BACKLOG, COVERED, EXCLUDED } from './covered-keys.ts';
import { type OssProject, projects } from './projects.ts';
import {
  CODEC_KINDS,
  type CodecKind,
  type ParsedConfig,
} from '../src/domain/entities/config-value.ts';
import { codecFor } from '../src/adapters/codecs/store.ts';

export type { OssProject } from './projects.ts';
export { projects } from './projects.ts';

export interface SnapshotEntry {
  readonly project: string;
  readonly file: string;
  readonly codecKind: CodecKind;
  readonly content: string;
}

export interface Snapshot {
  readonly formatVersion?: 1;
  readonly projectCount?: number;
  readonly updatedAt: string;
  readonly entries: readonly SnapshotEntry[];
}

export const REPOS_DIR = path.join(import.meta.dirname, 'repos');

const readProjectEntries = (project: OssProject, reposDir: string): SnapshotEntry[] => {
  const projectDir = path.join(reposDir, project.name);
  return project.configFiles.flatMap((configFile) => {
    const filePath = path.join(projectDir, configFile.path);
    if (!existsSync(filePath)) {
      return [];
    }
    return [
      {
        codecKind: configFile.codecKind,
        content: readFileSync(filePath, 'utf8'),
        file: configFile.path,
        project: project.name,
      },
    ];
  });
};

export const fetchSnapshotLocal = (reposDir: string): { snapshot: Snapshot; skipped: string[] } => {
  const entries: SnapshotEntry[] = [];
  const skipped: string[] = [];

  for (const project of projects) {
    const projectEntries = readProjectEntries(project, reposDir);
    entries.push(...projectEntries);
    if (projectEntries.length === 0) {
      skipped.push(project.name);
    }
  }

  return {
    skipped,
    snapshot: {
      entries,
      formatVersion: 1,
      projectCount: new Set(entries.map((entry) => entry.project)).size,
      updatedAt: new Date().toISOString(),
    },
  };
};

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

const SnapshotSchema = vb.object({
  formatVersion: vb.optional(vb.literal(1)),
  projectCount: vb.optional(vb.pipe(vb.number(), vb.integer(), vb.minValue(0))),
  updatedAt: vb.string(),
  entries: vb.pipe(
    vb.array(
      vb.object({
        project: vb.pipe(vb.string(), vb.minLength(1)),
        file: vb.pipe(vb.string(), vb.minLength(1)),
        codecKind: vb.picklist(CODEC_KINDS),
        content: vb.string(),
      }),
    ),
    vb.minLength(1, 'Snapshot contains no inspected configurations.'),
  ),
});

const parseSnapshot = (value: unknown): Snapshot => {
  const snapshot = vb.parse(SnapshotSchema, value);
  const seen = new Set<string>();
  for (const entry of snapshot.entries) {
    const key = JSON.stringify([entry.project, entry.file]);
    if (seen.has(key)) throw new Error(`Duplicate snapshot entry: ${entry.project}/${entry.file}`);
    seen.add(key);
  }
  if (
    snapshot.projectCount !== undefined &&
    snapshot.projectCount !== new Set(snapshot.entries.map((entry) => entry.project)).size
  )
    throw new Error('Snapshot projectCount does not match the inspected projects.');
  return snapshot;
};

const coveredByFile = new Map(Object.entries(COVERED));
const excludedByFile = new Map(Object.entries(EXCLUDED));
const backlogByFile = new Map(
  Object.entries(BACKLOG).map(([file, entries]) => [
    file,
    new Map(entries.map((entry) => [entry.key, entry.reason])),
  ]),
);

export const checkCoverage = (input: unknown): CoverageResult => {
  const snapshot = parseSnapshot(input);
  const gaps: CoverageGap[] = [];
  const backlogHits: BacklogHit[] = [];
  for (const entry of snapshot.entries) {
    const parsed = codecFor(entry.codecKind).parse(entry.content);
    const uncovered: string[] = [];
    for (const key of extractKeys(parsed, entry.codecKind)) {
      if (coveredByFile.get(entry.file)?.has(key) || excludedByFile.get(entry.file)?.has(key))
        continue;
      const reason = backlogByFile.get(entry.file)?.get(key);
      if (reason === undefined) uncovered.push(key);
      else backlogHits.push({ project: entry.project, file: entry.file, key, reason });
    }
    if (uncovered.length > 0)
      gaps.push({ project: entry.project, file: entry.file, keys: uncovered });
  }
  return { gaps, backlogHits, checked: snapshot.entries.length };
};
