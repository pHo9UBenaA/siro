import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readPackageVersion, renderVersionModule } from '../../scripts/gen/lib/version.ts';
import path from 'node:path';
import { tmpdir } from 'node:os';

vi.setConfig({ testTimeout: 5000 });

const makeTempRoot = (): { getRoot: () => string } => {
  let root = '';
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'siro-gen-version-'));
  });
  afterEach(() => {
    rmSync(root, { force: true, recursive: true });
  });
  return { getRoot: (): string => root };
};

describe('readPackageVersion — success', () => {
  const { getRoot } = makeTempRoot();

  it('returns the version field from package.json', () => {
    expect.hasAssertions();
    writeFileSync(path.join(getRoot(), 'package.json'), JSON.stringify({ version: '1.2.3' }));
    expect(readPackageVersion(getRoot())).toBe('1.2.3');
  });
});

describe('readPackageVersion — error cases', () => {
  const { getRoot } = makeTempRoot();

  it('throws a descriptive error when package.json is malformed JSON', () => {
    expect.hasAssertions();
    writeFileSync(path.join(getRoot(), 'package.json'), '{ not valid json');
    expect(() => readPackageVersion(getRoot())).toThrow(/is not valid JSON/u);
  });

  it.each([
    ['absent', JSON.stringify({ name: 'demo' })],
    ['number', JSON.stringify({ version: 42 })],
    ['null', '{"version":null}'],
    ['array', JSON.stringify({ version: ['1', '2', '3'] })],
  ])('throws when the version field is %s', (_label, raw) => {
    expect.hasAssertions();
    writeFileSync(path.join(getRoot(), 'package.json'), raw);
    expect(() => readPackageVersion(getRoot())).toThrow(/no string `version` field/u);
  });

  it('throws when package.json does not exist', () => {
    expect.hasAssertions();
    expect(() => readPackageVersion(getRoot())).toThrow(/could not be read/u);
  });

  it('rejects an empty version string with a dedicated diagnostic', () => {
    expect.hasAssertions();
    writeFileSync(path.join(getRoot(), 'package.json'), JSON.stringify({ version: '' }));
    expect(() => readPackageVersion(getRoot())).toThrow(/empty `version` field/u);
  });

  it.each([
    ['single quote', "1.0.0'"],
    ['newline', '1.0.0\nmalicious'],
    ['backslash', String.raw`1.0.0\u0027`],
    ['spaces', '1.0.0 internal'],
  ])('rejects a version string containing %s', (_label, version) => {
    expect.hasAssertions();
    writeFileSync(path.join(getRoot(), 'package.json'), JSON.stringify({ version }));
    expect(() => readPackageVersion(getRoot())).toThrow(/disallowed characters/u);
  });
});

describe(renderVersionModule, () => {
  it('emits a single-quoted ESM constant carrying the version', () => {
    expect.hasAssertions();
    expect(renderVersionModule('1.2.3')).toBe(
      "// Auto-generated from package.json by scripts/gen/version.mjs.\nexport const version = '1.2.3';\n",
    );
  });

  it('preserves prerelease and build metadata in the SemVer literal', () => {
    expect.hasAssertions();
    expect(renderVersionModule('1.2.3-rc.1+abc')).toContain("'1.2.3-rc.1+abc'");
  });
});
