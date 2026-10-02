import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { namedRegistries } from '../../../src/core/rules/named-registries.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const pnpmBinding = bindingForTest(namedRegistries, 'pnpm');

describe('named-registries: check states', () => {
  it('ok when namedRegistries is absent', () => {
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when namedRegistries is an empty object', () => {
    expect(pnpmBinding.check(makeCtx(), { namedRegistries: {} }).state).toBe('ok');
  });

  it('reports configured namedRegistries for manual review', () => {
    const status = pnpmBinding.check(makeCtx(), {
      namedRegistries: { github: 'https://npm.pkg.github.com' },
    });
    assertCheckState(status, 'violation');
    expect(status.message).toContain('namedRegistries');
    expect(status.message).toContain('pnpm-workspace.yaml');

    expect(status.remediation).toMatchObject({ kind: 'manual', steps: expect.any(Array) });
  });
});
