import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';
import assert from 'node:assert';
import { ConfigError } from '../../src/shared/errors.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';
import { createRepoContext } from '../../src/adapters/repo-context.ts';

vi.setConfig({ testTimeout: 5000 });

// createRepoContext is the only adapter that touches both `FileSystem` and
// `PackageJson` parsing in the same factory. Both behaviours were previously
// observable only end-to-end (e2e.test.ts), so a refactor of resolveIn /
// safeParsePackageJson would have to wait for an integration failure to
// surface. Pin them at the unit boundary.

describe('createRepoContext — packageJson parsing', () => {
  it('returns packageJson: undefined when no package.json is present', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({});
    const ctx = createRepoContext(asAbsPath('/repo'), fs);
    expect(ctx.packageJson).toBeUndefined();
  });

  it('exposes a parsed package.json when the file is valid JSON', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({
      'package.json': JSON.stringify({ files: ['dist'], name: 'demo', version: '1.0.0' }),
    });
    const ctx = createRepoContext(asAbsPath('/repo'), fs);
    const pkg = ctx.packageJson;
    assert(pkg, 'expected packageJson');
    expect(pkg.name).toBe('demo');
    expect(pkg.version).toBe('1.0.0');
    expect(pkg.files).toStrictEqual(['dist']);
  });

  it('accepts a package.json that begins with a UTF-8 BOM', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({
      'package.json': `﻿${JSON.stringify({ name: 'bom-pkg', version: '1.0.0' })}`,
    });
    expect(() => createRepoContext(asAbsPath('/repo'), fs)).not.toThrow();
    const ctx = createRepoContext(asAbsPath('/repo'), fs);
    const pkg = ctx.packageJson;
    assert(pkg, 'expected packageJson');
    expect(pkg.name).toBe('bom-pkg');
  });

  it('throws ConfigError naming package.json when the file is not valid JSON', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({
      'package.json': '{ not valid json',
    });
    expect(() => createRepoContext(asAbsPath('/repo'), fs)).toThrow(ConfigError);
    expect(() => createRepoContext(asAbsPath('/repo'), fs)).toThrow(/package\.json/u);
  });
});

describe('createRepoContext — readText and exists', () => {
  it('resolves readText / exists relative to the root', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({
      '.npmrc': 'ignore-scripts=true\n',
      'package.json': JSON.stringify({ name: 'demo' }),
    });
    const ctx = createRepoContext(asAbsPath('/repo'), fs);
    expect(ctx.exists(asRelPath('.npmrc'))).toBe(true);
    expect(ctx.readText(asRelPath('.npmrc'))).toBe('ignore-scripts=true\n');
  });

  it('returns undefined from readText when the relative path does not exist', () => {
    expect.hasAssertions();
    const fs = createMemFileSystem({});
    const ctx = createRepoContext(asAbsPath('/repo'), fs);
    expect(ctx.readText(asRelPath('.npmrc'))).toBeUndefined();
  });
});
