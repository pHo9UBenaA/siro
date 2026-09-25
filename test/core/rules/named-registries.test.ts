import assert from 'node:assert';
import { namedRegistries } from '../../../src/core/rules/named-registries.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const { pnpm } = namedRegistries.bindings;
assert(pnpm, 'expected pnpm binding');
const pnpmBinding = pnpm;

describe('named-registries: check states', () => {
  it('ok when namedRegistries is absent', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), {}).state).toBe('ok');
  });

  it('ok when namedRegistries is an empty object', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { namedRegistries: {} }).state).toBe('ok');
  });

  it('reports configured namedRegistries for manual review', () => {
    const status = pnpmBinding.check(makeCtx(), {
      namedRegistries: { github: 'https://npm.pkg.github.com' },
    });
    assert(status.state === 'violation');
    expect(status.message).toContain('namedRegistries');
    expect(status.message).toContain('pnpm-workspace.yaml');

    expect(status.remediation).toMatchObject({ kind: 'manual', steps: expect.any(Array) });

    expect(Object.keys(namedRegistries.bindings).sort()).toEqual(['pnpm']);

    expect(namedRegistries.severity).toBe('info');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });
});
