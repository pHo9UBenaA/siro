import { asAbsPath } from '../../../src/shared/paths.ts';
import assert from 'node:assert';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';

vi.setConfig({ testTimeout: 5000 });

describe('hardened-mode × yarn: conditional documentedDefault (D22)', () => {
  const ctx: RepoContext = {
    exists: () => false,
    packageJson: void 0,
    readText: (): undefined => void 0,
    root: asAbsPath('/repo'),
  };
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
