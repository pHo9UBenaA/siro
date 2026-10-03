import { asAbsPath, lint, type LintOptions } from '../../../src/index.ts';
import { createMemFileSystem } from '../../helpers/memfs.ts';
import { manualSteps, automaticOperations } from '../../helpers/remediation.ts';
import { makePublishableCtx, makeCtx } from '../../helpers/ctx.ts';
import { bindingForTest } from '../../helpers/rules.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../../src/core/parse-config-file.ts';
import { pinExactVersions } from '../../../src/core/rules/pin-exact-versions.ts';
import { exitCodeForLint } from '../../../src/core/filter.ts';

describe('pin-exact-versions (npm)', () => {
  const ctx = makeCtx();
  const npm = bindingForTest(pinExactVersions, 'npm');

  it('requires exact saving and proposes only save-exact in .npmrc', () => {
    const status = npm.check(ctx, {});

    expect(status.state).toBe('violation');
    expect(npm.check(ctx, { 'save-exact': false }).state).toBe('violation');

    expect(pinExactVersions.severity).toBe('error');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });

    expect(automaticOperations(status)).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['save-exact'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it.each([
    { 'save-exact': true },
    { 'save-exact': true, 'save-prefix': '^' },
    { 'save-exact': false, 'save-prefix': '' },
    { 'save-prefix': '=' },
  ])('accepts settings that save an exact version: %j', (config) => {
    expect(npm.check(ctx, config).state).toBe('ok');
  });
});

it('reports large top-level and scoped Deno mappings without exceeding argument limits', () => {
  const imports = Object.fromEntries(Array.from({ length: 150_000 }, (_, i) => [`p${i}`, 'npm:x']));
  for (const [config, message] of [
    [
      { imports },
      '150000 deno imports are not pinned: imports.p0=npm:x, imports.p1=npm:x, imports.p2=npm:x (and 149997 more). Use `deno add --save-exact` or pin manually.',
    ],
    [
      { scopes: { './': imports } },
      '150000 deno imports are not pinned: scopes["./"].p0=npm:x, scopes["./"].p1=npm:x, scopes["./"].p2=npm:x (and 149997 more). Use `deno add --save-exact` or pin manually.',
    ],
  ] as const) {
    const text = JSON.stringify(config);
    expect(Buffer.byteLength(text)).toBeLessThan(8 * 1024 * 1024);
    const result = runLint({
      repository: createRepositoryEvaluation(makeCtx({ readText: () => text }), codecFor),
      targets: [{ pm: 'deno' }],
      ruleSet: [pinExactVersions],
    });
    expect(exitCodeForLint(result)).toBe(1);
    expect(result.findings).toMatchObject([
      {
        ruleId: 'pin-exact-versions',
        file: 'deno.json',
        severity: 'error',
        message: `${message} (available since deno 1.30.0)`,
        remediation: { kind: 'manual' },
      },
    ]);
  }
});

describe('pin-exact-versions (deno subpaths)', () => {
  const lintImport = (specifier: string) =>
    runLint({
      repository: createRepositoryEvaluation(
        makeCtx({ readText: () => JSON.stringify({ imports: { dependency: specifier } }) }),
        codecFor,
      ),
      targets: [{ pm: 'deno' }],
      ruleSet: [pinExactVersions],
    });

  it.each(['npm:lodash@4/fp', 'npm:@scope/pkg@1.x/subpath', 'jsr:@std/path@1/posix'])(
    'fails lint for the version range in %s',
    (specifier) => {
      expect(exitCodeForLint(lintImport(specifier))).toBe(1);
    },
  );

  it.each([
    'npm:lodash@4.17.21/fp',
    'npm:@scope/pkg@1.2.3/subpath',
    'jsr:@std/path@1.0.0-x.1/posix',
  ])('accepts the exact version in %s', (specifier) => {
    expect(lintImport(specifier).findings).toStrictEqual([]);
  });

  it.each([
    'npm:react/jsx-runtime',
    'npm:@scope/pkg/subpath',
    'jsr:@std/path/posix',
    'npm:react@next/jsx-runtime',
    'npm:foo@1.2.3.4',
  ])('flags the unpinned registry import %s', (specifier) => {
    expect(exitCodeForLint(lintImport(specifier))).toBe(1);
  });
});

describe('exact save prefixes', () => {
  it('accepts pnpm explicit equality pins', () => {
    expect(
      bindingForTest(pinExactVersions, 'pnpm').check(makeCtx(), { savePrefix: '=' }).state,
    ).toBe('ok');
  });

  it('reads Aube save-prefix from .npmrc', () => {
    const result = runLint({
      repository: createRepositoryEvaluation(
        makeCtx({
          readText: (path) => (path.endsWith('.npmrc') ? 'save-prefix=\n' : undefined),
        }),
        codecFor,
      ),
      targets: [{ pm: 'aube' }],
      ruleSet: [pinExactVersions],
    });
    expect(bindingForTest(pinExactVersions, 'aube').file?.path).toBe('.npmrc');
    expect(result.findings).toStrictEqual([]);
  });
});

it.each([
  [{ savePrefix: '' }, 'ok'],
  [{ 'save-prefix': '', savePrefix: '' }, 'ok'],
  [{ 'save-prefix': '', savePrefix: '^' }, 'violation'],
  [{ 'save-prefix': '^', savePrefix: '' }, 'violation'],
])('requires unambiguous Aube prefix settings: %j', (config, state) => {
  expect(bindingForTest(pinExactVersions, 'aube').check(makeCtx(), config).state).toBe(state);
});

describe('pin-exact-versions (bun)', () => {
  it('pin-exact-versions requires [install] exact=true', () => {
    const ruleBinding = bindingForTest(pinExactVersions, 'bun');

    expect(ruleBinding.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
    expect(ruleBinding.check(makePublishableCtx(), {}).state).toBe('violation');
    expect(ruleBinding.check(makePublishableCtx(), { install: { exact: true } }).state).toBe('ok');
    const setKey = automaticOperations(ruleBinding.check(makePublishableCtx(), {}))[0];
    expect(setKey).toMatchObject({ keyPath: ['install', 'exact'], value: true });
  });
});

describe('pin-exact-versions (deno)', () => {
  const ctx = makeCtx();
  const ruleBinding = bindingForTest(pinExactVersions, 'deno');

  it('ok when no imports key is present', () => {
    expect(ruleBinding.check(ctx, {}).state).toBe('ok');
  });

  it('ok when all jsr/npm imports are exact', () => {
    const config = {
      imports: {
        '@std/path': 'jsr:@std/path@1.0.0',
        react: 'npm:react@18.2.0',
      },
    };
    expect(ruleBinding.check(ctx, config).state).toBe('ok');
  });

  it('leaves URLs, relative paths and bare aliases outside the registry policy', () => {
    const config = {
      imports: {
        std: 'https://deno.land/std@0.211.0/path/mod.ts',
        relative: './local/path.ts',
        alias: '@std/path',
      },
    };
    expect(ruleBinding.check(ctx, config).state).toBe('ok');
  });

  it('reports unpinned npm and jsr imports with manual guidance', () => {
    const config = {
      imports: { '@std/path': 'jsr:@std/path@^1.0.0', react: 'npm:react@^18.2.0' },
    };
    const result = ruleBinding.check(ctx, config);
    expect(ruleBinding.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
    expect(manualSteps(result)).toEqual(
      expect.arrayContaining([expect.stringContaining('deno add --save-exact')]),
    );
    expect(result).toMatchObject({
      message: expect.stringMatching(/@std\/path.*react/u),
      state: 'violation',
    });
  });

  it('reports the total and truncates the sample when more than 3 imports are unpinned', () => {
    const config = {
      imports: {
        pkgA: 'jsr:@x/a@^1',
        pkgB: 'jsr:@x/b@^1',
        pkgC: 'jsr:@x/c@^1',
        pkgD: 'jsr:@x/d@^1',
        pkgE: 'jsr:@x/e@^1',
      },
    };
    expect(ruleBinding.check(ctx, config)).toMatchObject({
      message: expect.stringMatching(/5 deno imports are not pinned.*and 2 more/u),
      state: 'violation',
    });
  });
});

describe('pin-exact-versions (pnpm)', () => {
  it('requires savePrefix empty', () => {
    const ruleBinding = bindingForTest(pinExactVersions, 'pnpm');

    expect(ruleBinding.check(makePublishableCtx(), {}).state).toBe('violation');
    expect(ruleBinding.check(makePublishableCtx(), { savePrefix: '' }).state).toBe('ok');
  });
});

describe('pin-exact-versions (yarn)', () => {
  it('requires defaultSemverRangePrefix empty', () => {
    const ruleBinding = bindingForTest(pinExactVersions, 'yarn');

    expect(ruleBinding.check(makePublishableCtx(), { defaultSemverRangePrefix: '^' }).state).toBe(
      'violation',
    );
    expect(ruleBinding.check(makePublishableCtx(), { defaultSemverRangePrefix: '' }).state).toBe(
      'ok',
    );
  });
});

describe('Deno manifest integration', () => {
  const inspect = (files: Record<string, string>, options: Partial<LintOptions> = {}) =>
    lint({
      cwd: asAbsPath('/repo'),
      fs: createMemFileSystem(files),
      installationRoots: [],
      ...options,
    });

  it('checks registry ranges in every inline Deno scope and identifies their locations', () => {
    const result = inspect(
      {
        'deno.json': JSON.stringify({
          imports: { x: 'npm:lodash@4.17.21/fp' },
          scopes: {
            './first/': { x: 'npm:lodash@^4/fp' },
            './second/': { x: 'jsr:@std/path@1/posix', blocked: null },
          },
        }),
      },
      { installationRoots: ['.'], pm: 'deno' },
    );
    const finding = result.findings.find((candidate) => candidate.ruleId === 'pin-exact-versions');
    expect(finding?.severity).toBe('error');
    expect(finding?.message).toContain('./first/');
    expect(finding?.message).toContain('./second/');
  });

  it.each([{ imports: [] }, { imports: { x: 3 } }, { scopes: [] }, { scopes: { './x/': false } }])(
    'does not call malformed import maps pinned: %j',
    (config) => {
      expect(() =>
        inspect({ 'deno.json': JSON.stringify(config) }, { installationRoots: ['.'], pm: 'deno' }),
      ).toThrow(/deno.json/);
    },
  );
});

it.each([
  { pm: 'npm', npmrc: 'save-prefix=null', pinned: false },
  { pm: 'npm', npmrc: 'save-prefix="null"', pinned: false },
  { pm: 'npm', npmrc: 'save-prefix=', pinned: true },
  { pm: 'npm', npmrc: 'save-prefix=""', pinned: true },
  { pm: 'npm', npmrc: 'save-prefix==', pinned: true },
  { pm: 'npm', npmrc: '', pinned: false },
  { pm: 'npm', npmrc: 'save-prefix=null\nsave-exact=true', pinned: true },
  { pm: 'aube', npmrc: 'save-prefix=null', pinned: false },
  { pm: 'aube', npmrc: 'savePrefix=null', pinned: false },
  { pm: 'aube', npmrc: 'save-prefix=', pinned: true },
  { pm: 'aube', npmrc: 'save-prefix=\nsavePrefix=null', pinned: false },
] as const)('evaluates $pm pinning from the file: $npmrc', ({ pm, npmrc, pinned }) => {
  const fs = createMemFileSystem({ '.npmrc': npmrc });
  const result = lint({ cwd: asAbsPath('/repo'), fs, pm });
  const pinningFindings = result.findings.filter(
    (finding) => finding.ruleId === 'pin-exact-versions',
  );
  expect(pinningFindings).toHaveLength(pinned ? 0 : 1);
});
