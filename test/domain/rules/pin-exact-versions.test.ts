import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/application/run-lint.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { exitCodeForLint } from '../../../src/domain/services/filter.ts';
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

describe('pin-exact-versions (deno subpaths)', () => {
  it.each(['npm:lodash@4/fp', 'npm:@scope/pkg@1.x/subpath', 'jsr:@std/path@1/posix'])(
    'fails lint for the version range in %s',
    (specifier) => {
      expect.hasAssertions();
      const result = runLint({
        codecFor,
        ctx: makeCtx({
          readText: () => JSON.stringify({ imports: { dependency: specifier } }),
        }),
        pms: ['deno'],
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
      codecFor,
      ctx: makeCtx({
        readText: () => JSON.stringify({ imports: { dependency: specifier } }),
      }),
      pms: ['deno'],
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
      codecFor,
      ctx: makeCtx({
        readText: () => JSON.stringify({ imports: { dependency: specifier } }),
      }),
      pms: ['deno'],
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
      codecFor,
      ctx: makeCtx({
        readText: (path) => (path.endsWith('.npmrc') ? 'save-prefix=\n' : undefined),
      }),
      pms: ['aube'],
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
