import { makeCtx } from '../../helpers/ctx.ts';
import assert from 'node:assert';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';

describe('hardened-mode × yarn: conditional documentedDefault (D22)', () => {
  const ctx = makeCtx();
  const { yarn } = hardenedMode.bindings;
  if (typeof yarn === 'undefined') {
    throw new TypeError('yarn binding missing');
  }

  it('keeps the unset case at full severity when the PR environment is unverified', () => {
    expect.hasAssertions();
    const status = yarn.check(ctx, {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
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
