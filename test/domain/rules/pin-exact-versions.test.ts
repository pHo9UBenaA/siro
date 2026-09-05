import { makeCtx } from '../../helpers/ctx.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { exitCodeForLint } from '../../../src/domain/services/filter.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { runLint } from '../../../src/application/run-lint.ts';

vi.setConfig({ testTimeout: 5000 });

describe('pin-exact-versions (npm)', () => {
  const ctx = makeCtx();
  const { npm } = pinExactVersions.bindings;
  if (!npm) {
    throw new TypeError('expected npm binding');
  }

  it('is an error-severity rule targeting .npmrc', () => {
    expect.hasAssertions();
    expect(pinExactVersions.severity).toBe('error');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('flags a violation when save-exact is not enabled', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, {}).state).toBe('violation');
    expect(npm.check(ctx, { 'save-exact': false }).state).toBe('violation');
  });

  it('flags a violation when save-exact alone is set (save-prefix still defaulting to ^)', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'save-exact': true }).state).toBe('violation');
  });

  it('still flags a violation when save-exact=true but save-prefix is non-empty', () => {
    expect.hasAssertions();
    const result = npm.check(ctx, { 'save-exact': true, 'save-prefix': '^' });
    expect(result.state).toBe('violation');
  });

  it('passes when save-exact=true and save-prefix is empty', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'save-exact': true, 'save-prefix': '' }).state).toBe('ok');
  });

  it('fixes by setting save-exact=true and save-prefix=""', () => {
    expect.hasAssertions();
    const ops = npm.fix(ctx);
    expect(ops).toContainEqual({
      file: { kind: 'npmrc', path: '.npmrc' },
      keyPath: ['save-exact'],
      op: 'setKey',
      value: true,
    });
    expect(ops).toContainEqual({
      file: { kind: 'npmrc', path: '.npmrc' },
      keyPath: ['save-prefix'],
      op: 'setKey',
      value: '',
    });
  });
});

describe('pin-exact-versions (deno subpaths)', () => {
  it.each([
    'npm:lodash@4/fp',
    'npm:lodash@4.x/fp',
    'npm:@scope/pkg@1/subpath',
    'npm:@scope/pkg@1.x/subpath',
    'jsr:@std/path@1/posix',
    'jsr:@std/path@1.x/posix',
  ])('fails lint for the version range in %s', (specifier) => {
    expect.hasAssertions();
    const result = runLint({
      codecFor,
      ctx: makeCtx({
        readText: () => JSON.stringify({ imports: { dependency: specifier } }),
      }),
      pms: ['deno'],
      ruleSet: [pinExactVersions],
    });
    const FAILURE = 1;
    expect(exitCodeForLint(result)).toBe(FAILURE);
  });

  it.each([
    'npm:lodash@4.17.21/fp',
    'npm:@scope/pkg@1.2.3/subpath',
    'jsr:@std/path@1.0.0/posix',
    'npm:foo@1.0.0-x.1/subpath',
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
    'npm:react',
    'npm:react/jsx-runtime',
    'npm:@scope/pkg/subpath',
    'jsr:@scope/pkg',
    'jsr:@std/path/posix',
  ])('retains no-range behavior for the unversioned import %s', (specifier) => {
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
});
