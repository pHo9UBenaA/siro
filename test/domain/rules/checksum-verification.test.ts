import assert from 'node:assert';
import { checksumVerification } from '../../../src/domain/rules/checksum-verification.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const yarnBinding = checksumVerification.bindings.yarn;
assert(yarnBinding, 'expected yarn binding');

describe('checksum-verification: check states', () => {
  it('passes when checksumBehavior is throw', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), { checksumBehavior: 'throw' }).state).toBe('ok');
  });

  it('flags a violation when set to ignore', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { checksumBehavior: 'ignore' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('checksum-verification: scope, metadata, and fix', () => {
  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = yarnBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBe('info');

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: '.yarnrc.yml' },
        keyPath: ['checksumBehavior'],
        op: 'setKey',
        value: 'throw',
      },
    ]);
    expect(Object.keys(checksumVerification.bindings).sort()).toEqual(['yarn']);

    expect(checksumVerification.severity).toBe('warn');
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
  });
});
