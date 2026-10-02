import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../../src/core/parse-config-file.ts';
import { pinExactVersions } from '../../../src/core/rules/pin-exact-versions.ts';
import { exitCodeForLint } from '../../../src/core/filter.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

describe('pin-exact-versions (npm)', () => {
  const ctx = makeCtx();
  const { npm } = pinExactVersions.bindings;
  if (!npm) {
    throw new TypeError('expected npm binding');
  }

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
  it.each(['npm:lodash@4/fp', 'npm:@scope/pkg@1.x/subpath', 'jsr:@std/path@1/posix'])(
    'fails lint for the version range in %s',
    (specifier) => {
      expect.hasAssertions();
      const result = runLint({
        repository: createRepositoryEvaluation(
          makeCtx({
            readText: () => JSON.stringify({ imports: { dependency: specifier } }),
          }),
          codecFor,
        ),
        targets: [{ pm: 'deno' }],
        ruleSet: [pinExactVersions],
      });

      expect(exitCodeForLint(result)).toBe(1);
    },
  );

  it.each([
    'npm:lodash@4.17.21/fp',
    'npm:@scope/pkg@1.2.3/subpath',
    'jsr:@std/path@1.0.0-x.1/posix',
  ])('accepts the exact version in %s', (specifier) => {
    expect.hasAssertions();
    const result = runLint({
      repository: createRepositoryEvaluation(
        makeCtx({
          readText: () => JSON.stringify({ imports: { dependency: specifier } }),
        }),
        codecFor,
      ),
      targets: [{ pm: 'deno' }],
      ruleSet: [pinExactVersions],
    });
    expect(result.findings).toStrictEqual([]);
  });

  it.each([
    'npm:react/jsx-runtime',
    'npm:@scope/pkg/subpath',
    'jsr:@std/path/posix',
    'npm:react@next/jsx-runtime',
    'npm:foo@1.2.3.4',
  ])('flags the unpinned registry import %s', (specifier) => {
    expect.hasAssertions();
    const result = runLint({
      repository: createRepositoryEvaluation(
        makeCtx({
          readText: () => JSON.stringify({ imports: { dependency: specifier } }),
        }),
        codecFor,
      ),
      targets: [{ pm: 'deno' }],
      ruleSet: [pinExactVersions],
    });
    expect(exitCodeForLint(result)).toBe(1);
  });
});

describe('exact save prefixes', () => {
  it('accepts pnpm explicit equality pins', () => {
    expect(pinExactVersions.bindings.pnpm?.check(makeCtx(), { savePrefix: '=' }).state).toBe('ok');
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
    expect(pinExactVersions.bindings.aube?.file?.path).toBe('.npmrc');
    expect(result.findings).toStrictEqual([]);
  });
});

it.each([
  [{ savePrefix: '' }, 'ok'],
  [{ 'save-prefix': '', savePrefix: '' }, 'ok'],
  [{ 'save-prefix': '', savePrefix: '^' }, 'violation'],
  [{ 'save-prefix': '^', savePrefix: '' }, 'violation'],
])('requires unambiguous Aube prefix settings: %j', (config, state) => {
  expect(pinExactVersions.bindings.aube?.check(makeCtx(), config).state).toBe(state);
});
