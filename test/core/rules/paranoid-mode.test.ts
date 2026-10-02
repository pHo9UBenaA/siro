import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
import { paranoidMode } from '../../../src/core/rules/paranoid-mode.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const aubeBinding = bindingForTest(paranoidMode, 'aube');

describe('paranoid-mode: check states', () => {
  it('passes when paranoid is true', () => {
    expect(aubeBinding.check(makeCtx(), { paranoid: true }).state).toBe('ok');
  });

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = aubeBinding.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.message).toContain('paranoid');

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['paranoid'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it('flags a violation when paranoid is false', () => {
    expect(aubeBinding.check(makeCtx(), { paranoid: false }).state).toBe('violation');
  });
});
