import assert from 'node:assert';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { paranoidMode } from '../../../src/domain/rules/paranoid-mode.ts';

vi.setConfig({ testTimeout: 5000 });

const { aube } = paranoidMode.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('paranoid-mode: check states', () => {
  it('passes when paranoid is true', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { paranoid: true }).state).toBe('ok');
  });

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when paranoid is false', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { paranoid: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('paranoid-mode: scope, metadata, and fix', () => {
  it('only binds to aube', () => {
    expect.hasAssertions();
    expect(paranoidMode.bindings.npm).toBeUndefined();
    expect(paranoidMode.bindings.pnpm).toBeUndefined();
    expect(paranoidMode.bindings.yarn).toBeUndefined();
    expect(paranoidMode.bindings.bun).toBeUndefined();
    expect(paranoidMode.bindings.deno).toBeUndefined();
    expect(paranoidMode.bindings.aube).toBeDefined();
  });

  it('ships at info severity and targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(paranoidMode.severity).toBe('info');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('violation message mentions paranoid', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: aubeBinding,
      ctx: makeCtx(),
      substrings: ['paranoid'],
    });
  });

  it('fix returns setKey op for paranoid: true', () => {
    expect.hasAssertions();
    const ops = aubeBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['paranoid'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
