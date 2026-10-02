import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
import { frozenStore } from '../../../src/core/rules/frozen-store.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';

const pnpmBinding = bindingForTest(frozenStore, 'pnpm');

describe('frozen-store: check states', () => {
  it('ok when frozenStore is true', () => {
    expect(pnpmBinding.check(makeCtx(), { frozenStore: true }).state).toBe('ok');
  });

  it('requests store population before enabling a missing frozenStore', () => {
    const status = pnpmBinding.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.message).toContain('frozenStore');
    const steps = manualSteps(status);

    expect(steps[0]).toContain('Populate the store');
  });

  it('violation when frozenStore is false', () => {
    const status = pnpmBinding.check(makeCtx(), { frozenStore: false });
    assert(status.state === 'violation');
    expect(status.message).toContain('frozenStore');
  });
});
