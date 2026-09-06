import { makeCtx } from '../../helpers/ctx.ts';
import assert from 'node:assert';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';

describe('hardened-mode × yarn: conditional documentedDefault (D22)', () => {
  const ctx = makeCtx();
  const { yarn } = hardenedMode.bindings;
  if (typeof yarn === 'undefined') {
    throw new TypeError('yarn binding missing');
  }

  it('downgrades the unset case to a dynamic info advisory', () => {
    expect.hasAssertions();
    expect(yarn.check(ctx, {})).toMatchObject({ severity: 'info', state: 'violation' });
  });

  it('keeps explicit false at full severity (no dynamic severity)', () => {
    expect.hasAssertions();
    const status = yarn.check(ctx, { enableHardenedMode: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('accepts explicit true', () => {
    expect.hasAssertions();
    expect(yarn.check(ctx, { enableHardenedMode: true })).toStrictEqual({ state: 'ok' });
  });
});
