import assert from 'node:assert';
import { paranoidMode } from '../../../src/domain/rules/paranoid-mode.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const { aube } = paranoidMode.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('paranoid-mode: check states', () => {
  it('passes when paranoid is true', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { paranoid: true }).state).toBe('ok');
  });

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = aubeBinding.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
    expect(Object.keys(paranoidMode.bindings).sort()).toEqual(['aube']);

    expect(paranoidMode.severity).toBe('info');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });

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
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { paranoid: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});
