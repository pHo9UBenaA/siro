import { makeCtx } from '../../helpers/ctx.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { parsePackageJson } from '../../../src/domain/schemas/package-json.ts';

const ctxWithPackageJson = (pkg: unknown) => makeCtx({ packageJson: parsePackageJson(pkg) });

describe('disable-lifecycle-scripts × bun: trustedDependencies opt-out', () => {
  const { bun } = disableLifecycleScripts.bindings;
  if (typeof bun === 'undefined') {
    throw new TypeError('bun binding missing');
  }

  it('accepts an explicit empty trustedDependencies allow-list', () => {
    expect.hasAssertions();
    const ctx = ctxWithPackageJson({ name: 'x', trustedDependencies: [] });
    expect(bun.check(ctx, {})).toStrictEqual({ state: 'ok' });
  });

  it('still flags a non-empty trustedDependencies list when ignoreScripts is unset', () => {
    expect.hasAssertions();
    const ctx = ctxWithPackageJson({ name: 'x', trustedDependencies: ['esbuild'] });
    expect(bun.check(ctx, {}).state).toBe('violation');
  });

  it('accepts install.ignoreScripts = true regardless of package.json', () => {
    expect.hasAssertions();
    const ctx = ctxWithPackageJson({ name: 'x', trustedDependencies: ['esbuild'] });
    expect(bun.check(ctx, { install: { ignoreScripts: true } })).toStrictEqual({ state: 'ok' });
  });
});
