import { manualSteps } from '../../helpers/remediation.ts';
import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { storeServer } from '../../../src/domain/rules/store-server.ts';

const { pnpm } = storeServer.bindings;
assert(pnpm, 'expected pnpm binding');
const pnpmBinding = pnpm;

describe('store-server: check states', () => {
  it('ok when useRunningStoreServer is absent', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when useRunningStoreServer is false', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { useRunningStoreServer: false }).state).toBe('ok');
  });

  it('violation when useRunningStoreServer is true', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), { useRunningStoreServer: true });
    assert(status.state === 'violation');
    expect(status.message).toContain('useRunningStoreServer');
  });
});

describe('store-server: scope, metadata, and fix', () => {
  it('only binds to pnpm', () => {
    expect.hasAssertions();
    expect(storeServer.bindings.npm).toBeUndefined();
    expect(storeServer.bindings.yarn).toBeUndefined();
    expect(storeServer.bindings.bun).toBeUndefined();
    expect(storeServer.bindings.deno).toBeUndefined();
    expect(storeServer.bindings.aube).toBeUndefined();
    expect(storeServer.bindings.pnpm).toBeDefined();
  });

  it('ships at info severity and targets pnpm-workspace.yaml', () => {
    expect.hasAssertions();
    expect(storeServer.severity).toBe('info');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('provides actionable manual remediation', () => {
    expect.hasAssertions();
    const ops = manualSteps(pnpmBinding.check(makeCtx(), { useRunningStoreServer: true }))!;

    expect(ops).toHaveLength(1);
    expect(ops[0]).toContain('trusted environment');
  });
});
