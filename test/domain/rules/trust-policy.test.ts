import assert from 'node:assert';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { trustPolicy } from '../../../src/domain/rules/trust-policy.ts';

vi.setConfig({ testTimeout: 5000 });

const { pnpm } = trustPolicy.bindings;
assert(pnpm, 'expected pnpm binding');
const pnpmBinding = pnpm;

describe('trust-policy: check states', () => {
  it('passes when trustPolicy is no-downgrade', () => {
    expect.hasAssertions();
    expect(pnpmBinding.check(makeCtx(), { trustPolicy: 'no-downgrade' }).state).toBe('ok');
  });

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when trustPolicy is off', () => {
    expect.hasAssertions();
    const status = pnpmBinding.check(makeCtx(), { trustPolicy: 'off' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('trust-policy: scope, metadata, and fix', () => {
  it('binds to pnpm and aube', () => {
    expect.hasAssertions();
    expect(trustPolicy.bindings.npm).toBeUndefined();
    expect(trustPolicy.bindings.yarn).toBeUndefined();
    expect(trustPolicy.bindings.bun).toBeUndefined();
    expect(trustPolicy.bindings.deno).toBeUndefined();
    expect(trustPolicy.bindings.pnpm).toBeDefined();
    expect(trustPolicy.bindings.aube).toBeDefined();
  });

  it('ships at warn severity and targets pnpm-workspace.yaml', () => {
    expect.hasAssertions();
    expect(trustPolicy.severity).toBe('warn');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('includes version note in violation message', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: pnpmBinding,
      ctx: makeCtx(),
      substrings: ['available since pnpm 10.21.0'],
    });
  });

  it('fix returns setKey op for trustPolicy: no-downgrade', () => {
    expect.hasAssertions();
    const ops = pnpmBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'pnpm-workspace.yaml' },
        keyPath: ['trustPolicy'],
        op: 'setKey',
        value: 'no-downgrade',
      },
    ]);
  });
});

const { aube } = trustPolicy.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('trust-policy: aube binding', () => {
  it('passes when trustPolicy is no-downgrade', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { trustPolicy: 'no-downgrade' }).state).toBe('ok');
  });

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when trustPolicy is off', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { trustPolicy: 'off' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('fix returns setKey op for trustPolicy: no-downgrade', () => {
    expect.hasAssertions();
    const ops = aubeBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['trustPolicy'],
        op: 'setKey',
        value: 'no-downgrade',
      },
    ]);
  });
});
