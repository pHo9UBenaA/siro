import assert from 'node:assert';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { advisoryCheck } from '../../../src/domain/rules/advisory-check.ts';

vi.setConfig({ testTimeout: 5000 });

const { aube } = advisoryCheck.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('advisory-check: check states', () => {
  it('passes when advisoryCheck is on', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { advisoryCheck: 'on' }).state).toBe('ok');
  });

  it('passes when advisoryCheck is required', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { advisoryCheck: 'required' }).state).toBe('ok');
  });

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when advisoryCheck is off', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { advisoryCheck: 'off' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('advisory-check: scope, metadata, and fix', () => {
  it('only binds to aube', () => {
    expect.hasAssertions();
    expect(advisoryCheck.bindings.npm).toBeUndefined();
    expect(advisoryCheck.bindings.pnpm).toBeUndefined();
    expect(advisoryCheck.bindings.yarn).toBeUndefined();
    expect(advisoryCheck.bindings.bun).toBeUndefined();
    expect(advisoryCheck.bindings.deno).toBeUndefined();
    expect(advisoryCheck.bindings.aube).toBeDefined();
  });

  it('ships at warn severity and targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(advisoryCheck.severity).toBe('warn');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('violation message mentions advisoryCheck', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: aubeBinding,
      ctx: makeCtx(),
      substrings: ['advisoryCheck'],
    });
  });

  it('fix returns setKey op for advisoryCheck: on', () => {
    expect.hasAssertions();
    const ops = aubeBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['advisoryCheck'],
        op: 'setKey',
        value: 'on',
      },
    ]);
  });
});
