import { readFileSync, readdirSync, statSync } from 'node:fs';
import type { CodecKind } from '../src/domain/entities/config-value.ts';
import { codecFor } from '../src/adapters/codecs/store.ts';
import path from 'node:path';
import { safeParsePackageJson } from '../src/domain/schemas/package-json.ts';

vi.setConfig({ testTimeout: 5000 });

const MISSING: undefined = JSON.parse('{}')._;
const FIXTURES = path.join(import.meta.dirname, 'fixtures');

const EXACT_CODEC_MAP: Record<string, CodecKind> = {
  '.npmrc': 'npmrc',
  '.yarnrc.yml': 'yaml',
  'bunfig.toml': 'toml',
  'deno.json': 'json',
  'package.json': 'json',
};

const codecByExtension = (filename: string): CodecKind | undefined => {
  const ext = path.extname(filename);
  if (ext === '.yaml' || ext === '.yml') {
    return 'yaml';
  }
  if (filename.endsWith('-workspace.yaml')) {
    return 'yaml';
  }
  return MISSING;
};

const codecKindFor = (filename: string): CodecKind | undefined => {
  const exact = EXACT_CODEC_MAP[filename];
  if (exact !== MISSING) {
    return exact;
  }
  return codecByExtension(filename);
};

const collectFilesFromDir = (
  dirName: string,
  out: { dir: string; file: string; full: string }[],
): void => {
  const dirFull = path.join(FIXTURES, dirName);
  for (const file of readdirSync(dirFull)) {
    out.push({ dir: dirName, file, full: path.join(dirFull, file) });
  }
};

const listFixtureFiles = (): { dir: string; file: string; full: string }[] => {
  const out: { dir: string; file: string; full: string }[] = [];
  for (const dirName of readdirSync(FIXTURES)) {
    const dirFull = path.join(FIXTURES, dirName);
    if (statSync(dirFull).isDirectory()) {
      collectFilesFromDir(dirName, out);
    }
  }
  return out;
};

describe('fixtures', () => {
  const files = listFixtureFiles();

  it('contains at least one entry per package manager', () => {
    expect.hasAssertions();
    const dirs = new Set(files.map((entry) => entry.dir));
    expect(dirs).toStrictEqual(
      new Set(['npm-good', 'npm-bad', 'pnpm-good', 'yarn-good', 'bun-good', 'deno-good']),
    );
  });

  const codecCases = files.flatMap((entry) => {
    const kind = codecKindFor(entry.file);
    if (kind === MISSING) {
      return [];
    }
    return [{ ...entry, kind }];
  });
  it.each(codecCases)('$dir/$file parses cleanly under the $kind codec', ({ full, kind }) => {
    expect.hasAssertions();
    const text = readFileSync(full, 'utf8');
    expect(() => codecFor(kind).parse(text)).not.toThrow();
  });

  const packageJsons = files.filter((entry) => entry.file === 'package.json');
  it.each(packageJsons)('$dir/package.json conforms to the PackageJson schema', ({ full }) => {
    expect.hasAssertions();
    const parsed = JSON.parse(readFileSync(full, 'utf8'));
    expect(safeParsePackageJson(parsed)).toBeDefined();
  });
});
