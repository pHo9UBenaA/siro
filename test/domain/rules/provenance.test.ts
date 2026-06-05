import type { PackageJson } from '../../../src/domain/schemas/package-json.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { provenance } from '../../../src/domain/rules/provenance.ts';

vi.setConfig({ testTimeout: 5000 });

const ctxWith = (packageJson?: PackageJson): RepoContext => makeCtx({ packageJson });

const { npm } = provenance.bindings;
if (!npm) {
  throw new TypeError('expected npm binding');
}

describe('provenance (npm)', () => {
  it('is a warn-severity rule', () => {
    expect.hasAssertions();
    expect(provenance.severity).toBe('warn');
  });

  it('is N/A for private or nameless packages', () => {
    expect.hasAssertions();
    expect(npm.check(ctxWith({ name: 'x', private: true }), {}).state).toBe('na');
    expect(npm.check(ctxWith(), {}).state).toBe('na');
  });

  it('flags a violation for a publishable package without provenance', () => {
    expect.hasAssertions();
    expect(npm.check(ctxWith({ name: 'x' }), {}).state).toBe('violation');
  });

  it('passes for a publishable package with provenance=true', () => {
    expect.hasAssertions();
    expect(npm.check(ctxWith({ name: 'x' }), { provenance: true }).state).toBe('ok');
  });

  it('tells the user from which npm version provenance attestations became available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: npm,
      ctx: ctxWith({ name: 'x' }),
      substrings: ['available since npm 9.5.0'],
    });
  });
});
