import {
  RECOMMENDED_RELEASE_AGE_SECONDS,
  minimumReleaseAge,
} from '../../../src/domain/rules/minimum-release-age.ts';
import assert from 'node:assert';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';

vi.setConfig({ testTimeout: 5000 });

describe('bun bindings — install config rules', () => {
  describe('pin-exact-versions', () => {
    it('pin-exact-versions requires [install] exact=true', () => {
      expect.hasAssertions();
      const bd = pinExactVersions.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
      expect(bd.check(ctx(), {}).state).toBe('violation');
      expect(bd.check(ctx(), { install: { exact: true } }).state).toBe('ok');
      const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({ keyPath: ['install', 'exact'], value: true });
    });
    it('pin-exact-versions on bun: tells the user from which bun version install.exact is available', () => {
      expect.hasAssertions();
      expectMessageContains({
        binding: pinExactVersions.bindings.bun,
        ctx: ctx(),
        substrings: ['available since bun 0.6.10'],
      });
    });
  });
  describe('minimum-release-age', () => {
    it('minimum-release-age writes install.minimumReleaseAge (3 days in seconds)', () => {
      expect.hasAssertions();
      const bd = minimumReleaseAge.bindings.bun;
      assert(bd, 'expected binding');
      expect(
        bd.check(ctx(), { install: { minimumReleaseAge: RECOMMENDED_RELEASE_AGE_SECONDS } }).state,
      ).toBe('ok');
      const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({
        keyPath: ['install', 'minimumReleaseAge'],
        value: RECOMMENDED_RELEASE_AGE_SECONDS,
      });
    });
    it('minimum-release-age on bun: tells the user from which bun version the key is available', () => {
      expect.hasAssertions();
      expectMessageContains({
        binding: minimumReleaseAge.bindings.bun,
        ctx: ctx(),
        substrings: ['available since bun 1.3.0'],
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
      const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({ keyPath: ['install', 'frozenLockfile'], value: true });
    });
    it('frozen-lockfile on bun: tells the user from which bun version install.frozenLockfile is available', () => {
      expect.hasAssertions();
      expectMessageContains({
        binding: frozenLockfile.bindings.bun,
        ctx: ctx(),
        substrings: ['available since bun 0.6.10'],
      });
    });
  });
});

describe('bun bindings — lifecycle scripts', () => {
  describe('binding shape and check states', () => {
    it('targets bunfig.toml with static info severity', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
      expect(bd.severity).toBe('info');
    });
    it('violation when install.ignoreScripts is unset', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), {}).state).toBe('violation');
    });
    it('ok when install.ignoreScripts is true', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), { install: { ignoreScripts: true } }).state).toBe('ok');
    });
    it('fix writes install.ignoreScripts=true', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.bun;
      assert(bd, 'expected binding');
      const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
      expect(setKey).toMatchObject({ keyPath: ['install', 'ignoreScripts'], value: true });
    });
  });
  describe('message content', () => {
    it('documents both opt-out paths (bunfig.toml and package.json)', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.bun;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), {})).toMatchObject({
        message: expect.stringMatching(
          /ignoreScripts.*trustedDependencies|trustedDependencies.*ignoreScripts/u,
        ),
        state: 'violation',
      });
    });
    it('points users at bun 1.2.0 (when the key landed), not the 1.3 default-on prose', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.bun;
      assert(bd, 'expected binding');
      const res = bd.check(ctx(), {});
      assert(res.state === 'violation', 'expected violation state');
      expect(res.message).toContain('available since bun 1.2.0');
      expect(res.message).not.toContain('bun 1.3.0');
      expect(res.message).not.toMatch(/introduced the curated allow-list/u);
      expect(res.message).not.toMatch(/bun 1\.3\+/u);
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

  it('files-field applies to bun', () => {
    expect.hasAssertions();
    const bd = filesField.bindings.bun;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
  });
});
