import assert from 'node:assert';
import { checksumVerification } from '../../../src/domain/rules/checksum-verification.ts';
import { expectDocumentedDefaultDynamicInfo } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

const yarnBinding = checksumVerification.bindings.yarn;
assert(yarnBinding, 'expected yarn binding');

describe('checksum-verification: check states', () => {
  it('passes when checksumBehavior is throw', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), { checksumBehavior: 'throw' }).state).toBe('ok');
  });

  it('treats unset as documentedDefault info advisory', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(yarnBinding, makeCtx());
  });

  it('flags a violation when set to update', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { checksumBehavior: 'update' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when set to ignore', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { checksumBehavior: 'ignore' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when set to reset', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { checksumBehavior: 'reset' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('checksum-verification: scope, metadata, and fix', () => {
  it('only binds to yarn', () => {
    expect.hasAssertions();
    expect(checksumVerification.bindings.yarn).toBeDefined();
    expect(checksumVerification.bindings.npm).toBeUndefined();
    expect(checksumVerification.bindings.pnpm).toBeUndefined();
    expect(checksumVerification.bindings.bun).toBeUndefined();
    expect(checksumVerification.bindings.deno).toBeUndefined();
    expect(checksumVerification.bindings.aube).toBeUndefined();
  });

  it('ships at warn severity and targets .yarnrc.yml', () => {
    expect.hasAssertions();
    expect(checksumVerification.severity).toBe('warn');
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
  });

  it('fix returns setKey op for checksumBehavior: throw', () => {
    expect.hasAssertions();
    const ops = yarnBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: '.yarnrc.yml' },
        keyPath: ['checksumBehavior'],
        op: 'setKey',
        value: 'throw',
      },
    ]);
  });
});
