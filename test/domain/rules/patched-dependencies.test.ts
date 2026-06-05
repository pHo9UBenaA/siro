import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { patchedDependencies } from '../../../src/domain/rules/patched-dependencies.ts';

vi.setConfig({ testTimeout: 5000 });

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

  it('violation when patchedDependencies has entries', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), {
      patchedDependencies: { 'express@4.18.2': 'patches/express.patch' },
    });
    assert(status.state === 'violation');
    expect(status.message).toContain('patchedDependencies');
    expect(status.message).toContain('pnpm-workspace.yaml');
  });
});

describe('patched-dependencies: scope, metadata, and fix', () => {
  it('only binds to pnpm', () => {
    expect.hasAssertions();
    expect(patchedDependencies.bindings.npm).toBeUndefined();
    expect(patchedDependencies.bindings.yarn).toBeUndefined();
    expect(patchedDependencies.bindings.bun).toBeUndefined();
    expect(patchedDependencies.bindings.deno).toBeUndefined();
    expect(patchedDependencies.bindings.aube).toBeUndefined();
    expect(patchedDependencies.bindings.pnpm).toBeDefined();
  });

  it('ships at info severity and targets pnpm-workspace.yaml', () => {
    expect.hasAssertions();
    expect(patchedDependencies.severity).toBe('info');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('is an advisory binding', () => {
    expect.hasAssertions();
    expect(pnpmBinding.fixKind).toBe('advisory');
  });

  it('fix returns a note op', () => {
    expect.hasAssertions();
    const ops = pnpmBinding.fix(makeCtx());
    const SINGLE = 1;
    expect(ops).toHaveLength(SINGLE);
    expect(ops[0]).toMatchObject({ op: 'note' });
  });
});
