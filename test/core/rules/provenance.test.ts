import { makePublishableCtx, makeCtx } from '../../helpers/ctx.ts';
import { bindingForTest } from '../../helpers/rules.ts';
import { type RuleContext } from '../../../src/core/contracts/repo-context.ts';
import { provenance } from '../../../src/core/rules/provenance.ts';
import { type PackageJson } from '../../../src/core/contracts/package-json.ts';

const ctxWith = (packageJson?: PackageJson): RuleContext => makeCtx({ packageJson });

const npm = bindingForTest(provenance, 'npm');

describe('provenance (npm)', () => {
  it.each([true, false])('prefers an own manifest override over npmrc=%s', (value) => {
    const ctx = ctxWith({ name: 'x', publishConfig: { provenance: !value, access: 'public' } });
    expect(npm.check(ctx, { provenance: value })).toMatchObject(
      value
        ? {
            state: 'violation',
            file: 'package.json',
            actual: false,
            remediation: {
              kind: 'automatic',
              operations: [
                {
                  file: { path: 'package.json' },
                  keyPath: ['publishConfig', 'provenance'],
                  value: true,
                },
              ],
            },
          }
        : { state: 'ok' },
    );
  });

  it('is N/A for private or nameless packages', () => {
    expect(npm.check(ctxWith({ name: 'x', private: true }), {}).state).toBe('na');
    expect(npm.check(ctxWith(), {}).state).toBe('na');
  });

  it('reports a violation when a publishable package has no provenance', () => {
    expect(npm.check(ctxWith({ name: 'x' }), {}).state).toBe('violation');
  });

  it('passes for a publishable package with provenance=true', () => {
    expect(npm.check(ctxWith({ name: 'x' }), { provenance: true }).state).toBe('ok');
  });
});

describe('provenance (bun)', () => {
  const ctx = makePublishableCtx;

  it('tells bun users to publish via `bunx npm publish` because `bun publish` does not emit attestations yet', () => {
    const ruleBinding = bindingForTest(provenance, 'bun');

    expect(ruleBinding.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
    expect(ruleBinding.check(ctx(), {})).toMatchObject({
      message: expect.stringMatching(/bunx npm publish/u),
      state: 'violation',
    });
  });
});

describe('provenance (pnpm)', () => {
  const ctx = makePublishableCtx;

  it('provenance binds to .npmrc for pnpm (shared with npm)', () => {
    const ruleBinding = bindingForTest(provenance, 'pnpm');

    expect(ruleBinding.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
    const okState = ruleBinding.check(ctx(), { provenance: true }).state;
    expect(okState).toBe('ok');
    const violationState = ruleBinding.check(ctx(), {}).state;
    expect(violationState).toBe('violation');
  });
});

describe('provenance (yarn)', () => {
  const ctx = makePublishableCtx;

  it('provenance uses npmPublishProvenance and is gated on publishability', () => {
    const ruleBinding = bindingForTest(provenance, 'yarn');

    expect(ruleBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    expect(ruleBinding.check(ctx({ packageJson: { private: true } }), {}).state).toBe('na');
    expect(ruleBinding.check(ctx(), {}).state).toBe('violation');
    expect(ruleBinding.check(ctx(), { npmPublishProvenance: true }).state).toBe('ok');
  });
});
