import assert from 'node:assert';
import { patchedDependencies } from '../../../src/core/rules/patched-dependencies.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const { pnpm } = patchedDependencies.bindings;
assert(pnpm, 'expected pnpm binding');
const pnpmBinding = pnpm;

describe('patched-dependencies: check states', () => {
  it('ok when patchedDependencies key is absent', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when patchedDependencies is an empty object', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { patchedDependencies: {} }).state).toBe('ok');
  });

  it('reports configured patchedDependencies for manual review', () => {
    const status = pnpmBinding.check(makeCtx(), {
      patchedDependencies: { 'express@4.18.2': 'patches/express.patch' },
    });
    assert(status.state === 'violation');
    expect(status.message).toContain('patchedDependencies');
    expect(status.message).toContain('pnpm-workspace.yaml');

    expect(status.remediation).toMatchObject({ kind: 'manual', steps: expect.any(Array) });

    expect(Object.keys(patchedDependencies.bindings).sort()).toEqual(['pnpm']);

    expect(patchedDependencies.severity).toBe('info');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });
});
