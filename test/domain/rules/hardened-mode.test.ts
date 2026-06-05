import assert from 'node:assert';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

describe('hardened-mode rule identity', () => {
  it('ships at warn severity', () => {
    expect.hasAssertions();
    expect(hardenedMode.severity).toBe('warn');
  });

  it('only binds to yarn (no other PM has a single-toggle hardening mode)', () => {
    expect.hasAssertions();
    expect(hardenedMode.bindings.npm).toBeUndefined();
    expect(hardenedMode.bindings.pnpm).toBeUndefined();
    expect(hardenedMode.bindings.bun).toBeUndefined();
    expect(hardenedMode.bindings.deno).toBeUndefined();
    expect(hardenedMode.bindings.aube).toBeUndefined();
    expect(hardenedMode.bindings.yarn).toBeDefined();
  });

  it('treats an unset key as a documentedDefault info advisory (D22)', () => {
    expect.hasAssertions();
    const yarnBinding = hardenedMode.bindings.yarn;
    assert(yarnBinding, 'expected yarn binding');
    const status = yarnBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBe('info');
  });
});
