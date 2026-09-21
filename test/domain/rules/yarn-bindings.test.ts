import assert from 'node:assert';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { minimumReleaseAge } from '../../helpers/rules.ts';

describe('yarn bindings — disable-lifecycle-scripts', () => {
  it('requires enableScripts: false', () => {
    expect.hasAssertions();
    const bd = disableLifecycleScripts.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    expect(bd.check(ctx(), {}).state).toBe('violation');
    expect(bd.check(ctx(), { enableScripts: false }).state).toBe('ok');
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

  it('accepts active Yarn duration strings and rejects disabled or invalid windows', () => {
    expect.hasAssertions();
    const bd = minimumReleaseAge.bindings.yarn;
    assert(bd, 'expected binding');
    const values = ['1w', '1d', '1.5h', '.5m', '120', '1ms', '0m', '0', '-1d', '1y', '1d junk'];
    expect(
      values.map((npmMinimalAgeGate) => bd.check(ctx(), { npmMinimalAgeGate }).state),
    ).toStrictEqual([
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'ok',
      'violation',
      'violation',
      'violation',
      'violation',
      'violation',
    ]);
  });

  it('checks npmMinimalAgeGate', () => {
    expect.hasAssertions();
    const bd = minimumReleaseAge.bindings.yarn;
    assert(bd, 'expected binding');
    expect(bd.check(ctx(), { npmMinimalAgeGate: 1440 }).state).toBe('ok');
    const setKey = automaticOperations(bd.check(ctx(), {})).find((op) => op.op === 'setKey');
    assert(setKey, 'expected setKey op');
    expect(setKey).toMatchObject({
      keyPath: ['npmMinimalAgeGate'],
      value: 4320,
    });
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
});

describe('yarn bindings — hardened-mode', () => {
  it('requires and proposes enableHardenedMode on Yarn', () => {
    const bd = hardenedMode.bindings.yarn;
    assert(bd, 'expected binding');
    expect(hardenedMode.severity).toBe('warn');
    expect(Object.keys(hardenedMode.bindings)).toStrictEqual(['yarn']);
    expect(bd.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    const missing = bd.check(ctx(), {});
    expect(bd.check(ctx(), { enableHardenedMode: true }).state).toBe('ok');
    const explicitFalse = bd.check(ctx(), { enableHardenedMode: false });
    assert(explicitFalse.state === 'violation');
    expect(explicitFalse.severity).toBeUndefined();

    const setKey = automaticOperations(missing).find((op) => op.op === 'setKey');
    assert(setKey, 'expected setKey op');
    expect(setKey).toMatchObject({ keyPath: ['enableHardenedMode'], value: true });
  });
});
