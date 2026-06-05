import {
  DOCUMENTED_DEFAULT_MINUTES,
  RECOMMENDED_RELEASE_AGE_MINUTES,
  minimumReleaseAge,
} from '../../../src/domain/rules/minimum-release-age.ts';
import {
  expectDocumentedDefaultDynamicInfo,
  expectMessageContains,
  expectMessageContainsAndAvoids,
} from '../../helpers/binding-expectations.ts';
import assert from 'node:assert';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';

vi.setConfig({ testTimeout: 5000 });

describe('yarn bindings — disable-lifecycle-scripts', () => {
  it('requires enableScripts: false', () => {
    expect.hasAssertions();
    const bd = disableLifecycleScripts.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { enableScripts: false }).state).toBe('ok');
  });

  it('unset -> dynamic info via documentedDefault', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(disableLifecycleScripts.bindings.yarn, ctx());
  });

  it('tells the user from which yarn version enableScripts is available and when it became safe by default', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: disableLifecycleScripts.bindings.yarn,
      ctx: ctx(),
      options: {
        contains: ['available since yarn 2.0.0', 'default safe since yarn 4.14.0'],
        notMatching: [/yarn defaults enableScripts/u],
      },
    });
  });
});

describe('yarn bindings — pin-exact-versions and minimum-release-age', () => {
  it('requires defaultSemverRangePrefix empty', () => {
    expect.hasAssertions();
    const bd = pinExactVersions.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), { defaultSemverRangePrefix: '^' }).state).toBe('violation');
    expect(bd.check(ctx(), { defaultSemverRangePrefix: '' }).state).toBe('ok');
  });

  it('tells the user from which yarn version defaultSemverRangePrefix is available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: pinExactVersions.bindings.yarn,
      ctx: ctx(),
      substrings: ['available since yarn 2.0.0'],
    });
  });

  it('checks npmMinimalAgeGate', () => {
    expect.hasAssertions();
    const bd = minimumReleaseAge.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), { npmMinimalAgeGate: DOCUMENTED_DEFAULT_MINUTES }).state).toBe('ok');
    const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
    assert(setKey, 'expected setKey op');
    expect(setKey).toMatchObject({
      keyPath: ['npmMinimalAgeGate'],
      value: RECOMMENDED_RELEASE_AGE_MINUTES,
    });
  });

  it('unset -> dynamic info via documentedDefault', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(minimumReleaseAge.bindings.yarn, ctx());
  });
});

describe('yarn bindings — provenance, files-field, and frozen-lockfile', () => {
  it('provenance uses npmPublishProvenance and is gated on publishability', () => {
    expect.hasAssertions();
    const bd = provenance.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    expect(bd.check(ctx({ packageJson: { private: true } }), {}).state).toBe('na');
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { npmPublishProvenance: true }).state).toBe('ok');
  });

  it('files-field applies to yarn', () => {
    expect.hasAssertions();
    const bd = filesField.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), {}).state).toBe('violation');
  });

  it('frozen-lockfile on yarn: tells the user from which yarn version enableImmutableInstalls is available and when CI flips it on by default', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: frozenLockfile.bindings.yarn,
      ctx: ctx(),
      options: {
        contains: ['available since yarn 2.0.0', 'default safe since yarn 3.0.0 in CI'],
        notMatching: [/yarn defaults enableImmutableInstalls/u],
      },
    });
  });
});

describe('yarn bindings — hardened-mode', () => {
  it('hardened-mode requires enableHardenedMode: true on yarn', () => {
    expect.hasAssertions();
    const bd = hardenedMode.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { enableHardenedMode: true }).state).toBe('ok');
    expect(bd.check(ctx(), { enableHardenedMode: false }).state).toBe('violation');
  });

  it('hardened-mode fix writes enableHardenedMode: true', () => {
    expect.hasAssertions();
    const bd = hardenedMode.bindings.yarn;
    assert(bd, 'expected binding');
    const setKey = bd.fix(ctx()).find((op) => op.op === 'setKey');
    assert(setKey, 'expected setKey op');
    expect(setKey).toMatchObject({ keyPath: ['enableHardenedMode'], value: true });
  });

  it('hardened-mode on yarn: tells the user from which yarn version enableHardenedMode is available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: hardenedMode.bindings.yarn,
      ctx: ctx(),
      substrings: ['available since yarn 4.0.0', 'default safe since yarn 4.0.0'],
    });
  });
});
