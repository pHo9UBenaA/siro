import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';
import { asAbsPath } from '../../../src/shared/paths.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { safeParsePackageJson } from '../../../src/domain/schemas/package-json.ts';

vi.setConfig({ testTimeout: 5000 });

const ctxWithPackageJson = (pkg: unknown): RepoContext => ({
  exists: (): boolean => false,
  packageJson: safeParsePackageJson(pkg),
  readText: (): undefined => void 0,
  root: asAbsPath('/repo'),
});

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
