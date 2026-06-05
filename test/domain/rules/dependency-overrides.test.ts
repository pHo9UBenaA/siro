import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { dependencyOverrides } from '../../../src/domain/rules/dependency-overrides.ts';

vi.setConfig({ testTimeout: 5000 });

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
    expect(pnpmBinding.fixKind).toBe('advisory');
  });

  it('fix returns a note op', () => {
    expect.hasAssertions();
    const ops = pnpmBinding.fix(makeCtx());
    const SINGLE = 1;
    expect(ops).toHaveLength(SINGLE);
    expect(ops[0]).toMatchObject({ op: 'note' });
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
    expect(aubeBinding.fixKind).toBe('advisory');
  });

  it('fix returns a note op', () => {
    expect.hasAssertions();
    const ops = aubeBinding.fix(makeCtx());
    const SINGLE = 1;
    expect(ops).toHaveLength(SINGLE);
    expect(ops[0]).toMatchObject({ op: 'note' });
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
