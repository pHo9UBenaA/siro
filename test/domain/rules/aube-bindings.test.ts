import {
  DOCUMENTED_DEFAULT_MINUTES,
  RECOMMENDED_RELEASE_AGE_MINUTES,
  minimumReleaseAge,
} from '../../../src/domain/rules/minimum-release-age.ts';
import assert from 'node:assert';
import { commitLockfile } from '../../../src/domain/rules/commit-lockfile.ts';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { expectDocumentedDefaultDynamicInfo } from '../../helpers/binding-expectations.ts';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';

vi.setConfig({ testTimeout: 5000 });

describe('aube bindings: lifecycle and lockfile rules', () => {
  describe('disable-lifecycle-scripts', () => {
    it('requires jailBuilds: true', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
      expect(bd.check(ctx(), {}).state).toBe('violation');
    });

    it('requires strictDepBuilds: true alongside jailBuilds', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), { jailBuilds: true }).state).toBe('violation');
      expect(bd.check(ctx(), { strictDepBuilds: true }).state).toBe('violation');
      expect(bd.check(ctx(), { jailBuilds: true, strictDepBuilds: true }).state).toBe('ok');
    });

    it('fix sets both jailBuilds and strictDepBuilds', () => {
      expect.hasAssertions();
      const bd = disableLifecycleScripts.bindings.aube;
      assert(bd, 'expected binding');
      const ops = bd.fix(ctx());
      const aubeFile = { kind: 'yaml', path: 'aube-workspace.yaml' };
      expect(ops).toStrictEqual([
        { file: aubeFile, keyPath: ['jailBuilds'], op: 'setKey', value: true },
        { file: aubeFile, keyPath: ['strictDepBuilds'], op: 'setKey', value: true },
      ]);
    });
  });

  describe('commit-lockfile', () => {
    it('accepts a reused pnpm-lock.yaml as the aube lockfile', () => {
      expect.hasAssertions();
      const bd = commitLockfile.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.check(ctx({ exists: (fp) => fp === 'pnpm-lock.yaml' }), {}).state).toBe('ok');
    });

    it('files-field applies to aube', () => {
      expect.hasAssertions();
      const bd = filesField.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.check(ctx(), {}).state).toBe('violation');
    });
  });
});

describe('aube bindings: frozen-lockfile and minimum-release-age', () => {
  describe('frozen-lockfile', () => {
    it('unset → dynamic info via documentedDefault', () => {
      expect.hasAssertions();
      const bd = frozenLockfile.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
      expectDocumentedDefaultDynamicInfo(bd, ctx());
      const regression = bd.check(ctx(), { preferFrozenLockfile: false });
      expect(regression).toMatchObject({ state: 'violation' });
      expect(regression).not.toHaveProperty('severity');
      expect(bd.check(ctx(), { preferFrozenLockfile: true }).state).toBe('ok');
    });
  });

  describe('minimum-release-age', () => {
    it('unset → dynamic info via documentedDefault', () => {
      expect.hasAssertions();
      const bd = minimumReleaseAge.bindings.aube;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
      expectDocumentedDefaultDynamicInfo(bd, ctx());
      const regression = bd.check(ctx(), { minimumReleaseAge: 0 });
      expect(regression).toMatchObject({ state: 'violation' });
      expect(regression).not.toHaveProperty('severity');
      expect(bd.check(ctx(), { minimumReleaseAge: DOCUMENTED_DEFAULT_MINUTES }).state).toBe('ok');
    });

    it('fix recommends the recommended release age', () => {
      expect.hasAssertions();
      const bd = minimumReleaseAge.bindings.aube;
      assert(bd, 'expected binding');
      const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({
        keyPath: ['minimumReleaseAge'],
        value: RECOMMENDED_RELEASE_AGE_MINUTES,
      });
    });
  });
});
