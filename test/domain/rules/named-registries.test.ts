import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { namedRegistries } from '../../../src/domain/rules/named-registries.ts';

vi.setConfig({ testTimeout: 5000 });

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

  it('violation when namedRegistries has entries', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), {
      namedRegistries: { github: 'https://npm.pkg.github.com' },
    });
    assert(status.state === 'violation');
    expect(status.message).toContain('namedRegistries');
    expect(status.message).toContain('pnpm-workspace.yaml');
  });
});

describe('named-registries: scope, metadata, and fix', () => {
  it('only binds to pnpm', () => {
    expect.hasAssertions();
    expect(namedRegistries.bindings.npm).toBeUndefined();
    expect(namedRegistries.bindings.yarn).toBeUndefined();
    expect(namedRegistries.bindings.bun).toBeUndefined();
    expect(namedRegistries.bindings.deno).toBeUndefined();
    expect(namedRegistries.bindings.aube).toBeUndefined();
    expect(namedRegistries.bindings.pnpm).toBeDefined();
  });

  it('ships at info severity and targets pnpm-workspace.yaml', () => {
    expect.hasAssertions();
    expect(namedRegistries.severity).toBe('info');
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
