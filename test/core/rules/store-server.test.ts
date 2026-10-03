import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { storeServer } from '../../../src/core/rules/store-server.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const pnpmBinding = bindingForTest(storeServer, 'pnpm');

describe('store-server: check states', () => {
  it('ok when useRunningStoreServer is absent', () => {
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when useRunningStoreServer is false', () => {
    expect(pnpmBinding.check(makeCtx(), { useRunningStoreServer: false }).state).toBe('ok');
  });

  it('reports configured useRunningStoreServer for manual review', () => {
    const status = pnpmBinding.check(makeCtx(), { useRunningStoreServer: true });
    assertCheckState(status, 'violation');
    expect(status.message).toContain('useRunningStoreServer');

    expect(status.remediation).toMatchObject({ kind: 'manual', steps: expect.any(Array) });
  });
});
