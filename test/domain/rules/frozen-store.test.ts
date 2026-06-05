import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { frozenStore } from '../../../src/domain/rules/frozen-store.ts';

vi.setConfig({ testTimeout: 5000 });

const { pnpm } = frozenStore.bindings;
assert(pnpm, 'expected pnpm binding');
const pnpmBinding = pnpm;

describe('frozen-store: check states', () => {
  it('ok when frozenStore is true', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { frozenStore: true }).state).toBe('ok');
  });

  it('violation when frozenStore is absent', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.message).toContain('frozenStore');
  });

  it('violation when frozenStore is false', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), { frozenStore: false });
    assert(status.state === 'violation');
    expect(status.message).toContain('frozenStore');
  });
});

describe('frozen-store: scope, metadata, and fix', () => {
  it('only binds to pnpm', () => {
    expect.hasAssertions();
    expect(frozenStore.bindings.npm).toBeUndefined();
    expect(frozenStore.bindings.yarn).toBeUndefined();
    expect(frozenStore.bindings.bun).toBeUndefined();
    expect(frozenStore.bindings.deno).toBeUndefined();
    expect(frozenStore.bindings.aube).toBeUndefined();
    expect(frozenStore.bindings.pnpm).toBeDefined();
  });

  it('ships at info severity and targets pnpm-workspace.yaml', () => {
    expect.hasAssertions();
    expect(frozenStore.severity).toBe('info');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('is an advisory binding', () => {
    expect.hasAssertions();
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
