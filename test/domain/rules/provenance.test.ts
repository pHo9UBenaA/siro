import type { RuleContext } from '../../../src/core/contracts/repo-context.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';
import type { PackageJson } from '../../../src/core/contracts/package-json.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const ctxWith = (packageJson?: PackageJson): RuleContext => makeCtx({ packageJson });

const { npm } = provenance.bindings;
if (!npm) {
  throw new TypeError('expected npm binding');
}

describe('provenance (npm)', () => {
  it('is N/A for private or nameless packages', () => {
    expect.hasAssertions();
    expect(npm.check(ctxWith({ name: 'x', private: true }), {}).state).toBe('na');
    expect(npm.check(ctxWith(), {}).state).toBe('na');
  });

  it('warns when a publishable package has no provenance', () => {
    expect(npm.check(ctxWith({ name: 'x' }), {}).state).toBe('violation');

    expect(provenance.severity).toBe('warn');
  });

  it('passes for a publishable package with provenance=true', () => {
    expect.hasAssertions();
    expect(npm.check(ctxWith({ name: 'x' }), { provenance: true }).state).toBe('ok');
  });
});
