import assert from 'node:assert';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe('disable-lifecycle-scripts (npm)', () => {
  const ctx = makeCtx();
  const npmBinding = disableLifecycleScripts.bindings.npm;
  assert(npmBinding, 'expected npm binding');

  it('has an npm binding targeting .npmrc', () => {
    expect.hasAssertions();
    expect(npmBinding).toBeDefined();
    expect(npmBinding.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('flags a violation when ignore-scripts is missing', () => {
    expect.hasAssertions();
    const status = npmBinding.check(ctx, {});
    expect(status.state).toBe('violation');
  });

  it('flags a violation when ignore-scripts is false', () => {
    expect.hasAssertions();
    const status = npmBinding.check(ctx, { 'ignore-scripts': false });
    expect(status.state).toBe('violation');
  });

  it('passes when ignore-scripts is true', () => {
    expect.hasAssertions();
    const status = npmBinding.check(ctx, { 'ignore-scripts': true });
    expect(status.state).toBe('ok');
  });

  it('fixes by setting ignore-scripts=true in .npmrc', () => {
    expect.hasAssertions();
    const ops = npmBinding.fix(ctx);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['ignore-scripts'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});

describe('disable-lifecycle-scripts (pnpm): check states', () => {
  const ctx = makeCtx();
  const pnpmBinding = disableLifecycleScripts.bindings.pnpm;
  assert(pnpmBinding, 'expected pnpm binding');

  it('targets pnpm-workspace.yaml as a yaml binding', () => {
    expect.hasAssertions();
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('returns ok when strictDepBuilds is explicitly true', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(ctx, { strictDepBuilds: true }).state).toBe('ok');
  });

  it('emits a full-severity violation when strictDepBuilds is explicitly false', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(ctx, { strictDepBuilds: false });
    expect(status).toMatchObject({ actual: false, expected: true, state: 'violation' });
    // No documentedDefault demotion: an explicit `false` is the user
    // weakening the gate, not relying on the pnpm 11 default.
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('emits an info-severity violation when strictDepBuilds is unset (documentedDefault parity)', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(ctx, {});
    expect(status).toMatchObject({ severity: 'info', state: 'violation' });
  });
});

describe('disable-lifecycle-scripts (pnpm): bypass and fix', () => {
  const ctx = makeCtx();
  const pnpmBinding = disableLifecycleScripts.bindings.pnpm;
  assert(pnpmBinding, 'expected pnpm binding');

  it('emits a full-severity violation with manualSteps when dangerouslyAllowAllBuilds: true', () => {
    expect.hasAssertions();
    // The bypass dominates strictDepBuilds, so even when strictDepBuilds is
    // also true the binding must flag the bypass and tell the fixer it cannot
    // auto-resolve. Pinning the manualSteps shape protects the contract
    // run-lint.ts depends on for the "suppress fix, surface manualSteps" branch.
    const status = pnpmBinding.check(ctx, {
      dangerouslyAllowAllBuilds: true,
      strictDepBuilds: true,
    });
    expect(status).toMatchObject({
      actual: true,
      expected: false,
      state: 'violation',
    });
    assert(status.state === 'violation');
    expect(status.manualSteps).toBeDefined();
    const FIRST_ELEMENT = 0;
    assert(status.manualSteps, 'expected manualSteps');
    expect(status.manualSteps[FIRST_ELEMENT]).toMatch(/dangerouslyAllowAllBuilds/u);
  });

  it('auto-fixes by pinning strictDepBuilds, leaving the bypass case for the fixer to handle', () => {
    expect.hasAssertions();
    // fix() does not inspect config — the bypass-case skip lives in
    // run-lint.ts via the manualSteps contract above. The binding itself stays
    // a single-shape AutoRuleBinding.
    const ops = pnpmBinding.fix(ctx);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'pnpm-workspace.yaml' },
        keyPath: ['strictDepBuilds'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
