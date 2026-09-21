import assert from 'node:assert';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';
import { parsePackageJson } from '../../../src/domain/schemas/package-json.ts';
import { makePublishableCtx as ctx, makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { minimumReleaseAge } from '../../helpers/rules.ts';

describe('bun bindings — install config rules', () => {
  describe('pin-exact-versions', () => {
    it('pin-exact-versions requires [install] exact=true', () => {
      expect.hasAssertions();
      const bd = pinExactVersions.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
      expect(bd.check(ctx(), {}).state).toBe('violation');
      expect(bd.check(ctx(), { install: { exact: true } }).state).toBe('ok');
      const setKey = automaticOperations(bd.check(ctx(), {})).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({ keyPath: ['install', 'exact'], value: true });
    });
  });
  describe('minimum-release-age', () => {
    it('minimum-release-age writes install.minimumReleaseAge (3 days in seconds)', () => {
      expect.hasAssertions();
      const bd = minimumReleaseAge.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), { install: { minimumReleaseAge: 259200 } }).state).toBe('ok');
      const setKey = automaticOperations(bd.check(ctx(), {})).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({
        keyPath: ['install', 'minimumReleaseAge'],
        value: 259200,
      });
    });
  });
  describe('frozen-lockfile', () => {
    it('frozen-lockfile requires install.frozenLockfile=true (not install.frozen)', () => {
      expect.hasAssertions();
      const bd = frozenLockfile.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
      expect(bd.check(ctx(), { install: { frozen: true } }).state).toBe('violation');
      expect(bd.check(ctx(), { install: { frozenLockfile: true } }).state).toBe('ok');
      const missing = bd.check(ctx(), {});
      assert(missing.state === 'violation');
      expect(missing.severity).toBeUndefined();
      expect(frozenLockfile.severity).toBe('warn');
      expect(Object.keys(frozenLockfile.bindings).sort()).toEqual([
        'aube',
        'bun',
        'deno',
        'pnpm',
        'yarn',
      ]);
      const setKey = automaticOperations(missing).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({ keyPath: ['install', 'frozenLockfile'], value: true });
    });
  });
});

describe('bun bindings — publish rules', () => {
  describe('provenance rule', () => {
    it('tells bun users to publish via `bunx npm publish` because `bun publish` does not emit attestations yet', () => {
      expect.hasAssertions();
      const bd = provenance.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
      expect(bd.check(ctx(), {})).toMatchObject({
        message: expect.stringMatching(/bunx npm publish/u),
        state: 'violation',
      });
    });
  });
});

it('reports missing Bun script policy with opt-out guidance and a proposal', () => {
  const bd = disableLifecycleScripts.bindings.bun;
  assert(bd);
  const status = bd.check(ctx(), {});

  expect(bd.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
  expect(bd.severity).toBe('info');

  expect(status.state).toBe('violation');

  const setKey = automaticOperations(status).find((op) => op.op === 'setKey');
  expect(setKey).toMatchObject({ keyPath: ['install', 'ignoreScripts'], value: true });

  expect(status).toMatchObject({
    message: expect.stringMatching(
      /ignoreScripts.*trustedDependencies|trustedDependencies.*ignoreScripts/u,
    ),
    state: 'violation',
  });
});

const ctxWithPackageJson = (pkg: unknown) => makeCtx({ packageJson: parsePackageJson(pkg) });

describe('disable-lifecycle-scripts × bun: trustedDependencies opt-out', () => {
  const { bun } = disableLifecycleScripts.bindings;
  if (typeof bun === 'undefined') {
    throw new TypeError('bun binding missing');
  }

  it('accepts an explicit empty trustedDependencies allow-list', () => {
    expect.hasAssertions();
    const context = ctxWithPackageJson({ name: 'x', trustedDependencies: [] });
    expect(bun.check(context, {})).toStrictEqual({ state: 'ok' });
  });

  it('still flags a non-empty trustedDependencies list when ignoreScripts is unset', () => {
    expect.hasAssertions();
    const context = ctxWithPackageJson({ name: 'x', trustedDependencies: ['esbuild'] });
    expect(bun.check(context, {}).state).toBe('violation');
  });

  it('accepts install.ignoreScripts = true regardless of package.json', () => {
    expect.hasAssertions();
    const context = ctxWithPackageJson({ name: 'x', trustedDependencies: ['esbuild'] });
    expect(bun.check(context, { install: { ignoreScripts: true } })).toStrictEqual({ state: 'ok' });
  });
});
