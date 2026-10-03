import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { checksumVerification } from '../../../src/core/rules/checksum-verification.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const yarnBinding = bindingForTest(checksumVerification, 'yarn');

describe('checksum-verification: check states', () => {
  it('passes when checksumBehavior is throw', () => {
    expect(yarnBinding.check(makeCtx(), { checksumBehavior: 'throw' }).state).toBe('ok');
  });

  it('flags a violation when set to ignore', () => {
    expect(yarnBinding.check(makeCtx(), { checksumBehavior: 'ignore' }).state).toBe('violation');
  });
});

describe('checksum-verification: remediation', () => {
  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = yarnBinding.check(makeCtx(), {});
    assertCheckState(status, 'violation');
    expect(status.severity).toBe('info');

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: '.yarnrc.yml' },
        keyPath: ['checksumBehavior'],
        op: 'setKey',
        value: 'throw',
      },
    ]);
  });
});
