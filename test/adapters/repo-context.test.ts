import assert from 'node:assert';
import path from 'node:path';
import { asAbsPath } from '../../src/adapters/node-paths.ts';
import { createRepoContext } from '../../src/adapters/repo-context.ts';
import { asRelPath } from '../../src/core/contracts/paths.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

describe('createRepoContext — packageJson parsing', () => {
  it.each([
    ['private', { name: 'publishable', private: 'false' }],
    ['files', { files: 'dist' }],
    ['name', { name: 7 }],
    ['packageManager', { packageManager: [] }],
    ['publishConfig.access', { publishConfig: { access: 'junk' } }],
    ['trustedDependencies', { trustedDependencies: [42] }],
  ])('rejects malformed %s instead of silently changing its meaning', (field, value) => {
    const fs = createMemFileSystem({ 'package.json': JSON.stringify(value) });
    expect(() => createRepoContext(asAbsPath('/repo'), fs)).toThrow(
      expect.objectContaining({
        name: 'ConfigError',
        message: expect.stringContaining(`package.json: ${field}`),
      }),
    );
  });

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
    expect(() => createRepoContext(asAbsPath('/repo'), fs)).toThrow(
      expect.objectContaining({
        name: 'ConfigError',
        message: expect.stringContaining('package.json'),
      }),
    );
  });

  it('throws ConfigError when package.json contains a non-object JSON root', () => {
    const fs = createMemFileSystem({ 'package.json': '[]' });
    expect(() => createRepoContext(asAbsPath('/repo'), fs)).toThrow(
      /package\.json: expected an object/iu,
    );
  });
});

describe('createRepoContext — readText and exists', () => {
  it.each(['/repo', '/repo/packages/member'])(
    'reuses the %s manifest source while other files remain live',
    (root) => {
      let manifestReads = 0;
      let otherReads = 0;
      const manifest = path.join(root, 'package.json');
      const fs = {
        exists: () => false,
        readText: (file: string) => {
          if (file === manifest) {
            manifestReads++;
            return JSON.stringify({ private: manifestReads > 1 });
          }
          otherReads++;
          return String(otherReads);
        },
      };
      const ctx = createRepoContext(asAbsPath(root), fs);
      expect(ctx.packageJson?.private).toBe(false);
      expect(ctx.readText(asRelPath('package.json'))).toBe('{"private":false}');
      expect(ctx.readText(asRelPath('./package.json'))).toBe('{"private":false}');
      expect(manifestReads).toBe(1);
      expect(ctx.readText(asRelPath('.npmrc'))).toBe('1');
      expect(ctx.readText(asRelPath('.npmrc'))).toBe('2');
    },
  );

  it('keeps an absent manifest absent for this context', () => {
    let reads = 0;
    const ctx = createRepoContext(asAbsPath('/repo'), {
      exists: () => true,
      readText: () => (++reads === 1 ? undefined : '{}'),
    });
    expect(ctx.packageJson).toBeUndefined();
    expect(ctx.readText(asRelPath('package.json'))).toBeUndefined();
    expect(reads).toBe(1);
  });

  it('propagates a manifest read failure instead of treating it as absent', () => {
    const failure = new Error('EACCES: package.json');
    expect(() =>
      createRepoContext(asAbsPath('/repo'), {
        exists: () => false,
        readText: () => {
          throw failure;
        },
      }),
    ).toThrow(failure);
  });
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
