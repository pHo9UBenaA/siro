import { manualSteps } from '../../helpers/remediation.ts';
import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { dependencyOverrides } from '../../../src/domain/rules/dependency-overrides.ts';

describe('dependency-overrides: pnpm binding', () => {
  const { pnpm } = dependencyOverrides.bindings;
  assert(pnpm, 'expected pnpm binding');
  const pnpmBinding = pnpm;

  it('ok when overrides key is absent', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when overrides is an empty object', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { overrides: {} }).state).toBe('ok');
  });

  it('violation when overrides has entries', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), { overrides: { foo: '1.0.0' } });
    assert(status.state === 'violation');
    expect(status.message).toContain('overrides');
    expect(status.message).toContain('pnpm-workspace.yaml');
  });

  it('targets pnpm-workspace.yaml and is advisory', () => {
    expect.hasAssertions();
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('provides actionable manual remediation', () => {
    expect.hasAssertions();
    const ops = manualSteps(pnpmBinding.check(makeCtx(), { overrides: { dep: '1.2.3' } }))!;

    expect(ops).toHaveLength(1);
    expect(ops[0]).toContain('Review each entry');
  });
});

describe('dependency-overrides: aube binding', () => {
  const { aube } = dependencyOverrides.bindings;
  assert(aube, 'expected aube binding');
  const aubeBinding = aube;

  it('ok when overrides key is absent', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when overrides is an empty object', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { overrides: {} }).state).toBe('ok');
  });

  it('violation when overrides has entries', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { overrides: { bar: '2.0.0' } });
    assert(status.state === 'violation');
    expect(status.message).toContain('overrides');
    expect(status.message).toContain('aube-workspace.yaml');
  });

  it('targets aube-workspace.yaml and is advisory', () => {
    expect.hasAssertions();
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('provides actionable manual remediation', () => {
    expect.hasAssertions();
    const ops = manualSteps(aubeBinding.check(makeCtx(), { overrides: { dep: '1.2.3' } }))!;

    expect(ops).toHaveLength(1);
    expect(ops[0]).toContain('Review each entry');
  });
});

describe('dependency-overrides: scope', () => {
  it('only binds to pnpm and aube', () => {
    expect.hasAssertions();
    expect(dependencyOverrides.bindings.npm).toBeUndefined();
    expect(dependencyOverrides.bindings.yarn).toBeUndefined();
    expect(dependencyOverrides.bindings.bun).toBeUndefined();
    expect(dependencyOverrides.bindings.deno).toBeUndefined();
    expect(dependencyOverrides.bindings.pnpm).toBeDefined();
    expect(dependencyOverrides.bindings.aube).toBeDefined();
  });

  it('ships at info severity', () => {
    expect.hasAssertions();
    expect(dependencyOverrides.severity).toBe('info');
  });
});
