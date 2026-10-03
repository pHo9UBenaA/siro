import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { patchedDependencies } from '../../../src/core/rules/patched-dependencies.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const pnpmBinding = bindingForTest(patchedDependencies, 'pnpm');

describe('patched-dependencies: check states', () => {
  it('ok when patchedDependencies key is absent', () => {
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when patchedDependencies is an empty object', () => {
    expect(pnpmBinding.check(makeCtx(), { patchedDependencies: {} }).state).toBe('ok');
  });

  it('reports configured patchedDependencies for manual review', () => {
    const status = pnpmBinding.check(makeCtx(), {
      patchedDependencies: { 'express@4.18.2': 'patches/express.patch' },
    });
    assertCheckState(status, 'violation');
    expect(status.message).toContain('patchedDependencies');
    expect(status.message).toContain('pnpm-workspace.yaml');

    expect(status.remediation).toMatchObject({ kind: 'manual', steps: expect.any(Array) });
  });
});
