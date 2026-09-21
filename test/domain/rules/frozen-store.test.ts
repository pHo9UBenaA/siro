import assert from 'node:assert';
import { frozenStore } from '../../../src/domain/rules/frozen-store.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';

const { pnpm } = frozenStore.bindings;
assert(pnpm, 'expected pnpm binding');
const pnpmBinding = pnpm;

describe('frozen-store: check states', () => {
  it('ok when frozenStore is true', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { frozenStore: true }).state).toBe('ok');
  });

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = pnpmBinding.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.message).toContain('frozenStore');
    expect(Object.keys(frozenStore.bindings).sort()).toEqual(['pnpm']);

    expect(frozenStore.severity).toBe('info');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });

    const ops = manualSteps(status)!;

    expect(ops[0]).toContain('Populate the store');
  });

  it('violation when frozenStore is false', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), { frozenStore: false });
    assert(status.state === 'violation');
    expect(status.message).toContain('frozenStore');
  });
});
