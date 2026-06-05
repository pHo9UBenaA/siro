import {
  DOCUMENTED_DEFAULT_MINUTES,
  RECOMMENDED_RELEASE_AGE_MINUTES,
  minimumReleaseAge,
} from '../../../src/domain/rules/minimum-release-age.ts';
import {
  expectDocumentedDefaultDynamicInfo,
  expectMessageContainsAndAvoids,
} from '../../helpers/binding-expectations.ts';
import assert from 'node:assert';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';

vi.setConfig({ testTimeout: 5000 });

describe('pnpm bindings — disable-lifecycle-scripts', () => {
  it('requires strictDepBuilds', () => {
    expect.hasAssertions();
    const bd = disableLifecycleScripts.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { strictDepBuilds: true }).state).toBe('ok');
  });

  it('reports a dangerouslyAllowAllBuilds-named violation even when strictDepBuilds is true', () => {
    expect.hasAssertions();
    const bd = disableLifecycleScripts.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(
      bd.check(ctx(), { dangerouslyAllowAllBuilds: true, strictDepBuilds: true }),
    ).toMatchObject({
      message: expect.stringMatching(/dangerouslyAllowAllBuilds/u),
      state: 'violation',
    });
    expect(bd.check(ctx(), { dangerouslyAllowAllBuilds: false, strictDepBuilds: true }).state).toBe(
      'ok',
    );
  });

  it('unset -> dynamic info via documentedDefault', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(disableLifecycleScripts.bindings.pnpm, ctx());
  });

  it('tells the user from which pnpm version strictDepBuilds is available and when it became the default', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: disableLifecycleScripts.bindings.pnpm,
      ctx: ctx(),
      options: {
        contains: ['available since pnpm 10.3.0', 'default safe since pnpm 11.0.0'],
        notMatching: [/pnpm 11\+ defaults/u],
      },
    });
  });
});

describe('pnpm bindings — pin-exact-versions', () => {
  it('requires savePrefix empty', () => {
    expect.hasAssertions();
    const bd = pinExactVersions.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { savePrefix: '' }).state).toBe('ok');
  });
});

describe('pnpm bindings — age and lockfile', () => {
  it('checks minimumReleaseAge (3 days in minutes)', () => {
    expect.hasAssertions();
    const bd = minimumReleaseAge.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { minimumReleaseAge: DOCUMENTED_DEFAULT_MINUTES }).state).toBe('ok');
    const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
    assert(setKey, 'expected setKey op');
    expect(setKey).toMatchObject({
      keyPath: ['minimumReleaseAge'],
      value: RECOMMENDED_RELEASE_AGE_MINUTES,
    });
  });

  it('unset -> dynamic info via documentedDefault', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(minimumReleaseAge.bindings.pnpm, ctx());
  });

  it('frozen-lockfile on pnpm: unset -> dynamic info via documentedDefault', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(frozenLockfile.bindings.pnpm, ctx());
  });
});

describe('pnpm bindings — files-field and provenance', () => {
  it('files-field applies to pnpm too', () => {
    expect.hasAssertions();
    const bd = filesField.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx({ packageJson: { files: ['dist'] } }), {}).state).toBe('ok');
  });

  it('provenance binds to .npmrc for pnpm (shared with npm)', () => {
    expect.hasAssertions();
    const bd = provenance.bindings.pnpm;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
    const okState = bd.check(ctx(), { provenance: true }).state;
    expect(okState).toBe('ok');
    const violationState = bd.check(ctx(), {}).state;
    expect(violationState).toBe('violation');
  });
});
