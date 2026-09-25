import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { advisoryCheck } from '../../../src/domain/rules/advisory-check.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const { aube } = advisoryCheck.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('advisory-check: check states', () => {
  it.each<ParsedConfig>([{ advisoryCheck: 'off', paranoid: true }])(
    'accepts paranoid despite individual settings: %j',
    (config) => {
      expect.hasAssertions();
      expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
    },
  );

  it('passes when advisoryCheck is on', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { advisoryCheck: 'on' }).state).toBe('ok');
  });

  it('passes when advisoryCheck is required', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { advisoryCheck: 'required' }).state).toBe('ok');
  });
});

describe('advisory-check: scope, metadata, and fix', () => {
  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = aubeBinding.check(makeCtx(), {});

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['advisoryCheck'],
        op: 'setKey',
        value: 'on',
      },
    ]);
    expect(Object.keys(advisoryCheck.bindings).sort()).toEqual(['aube']);

    expect(advisoryCheck.severity).toBe('warn');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });

    assert(status.state === 'violation');
    expect(status.message).toContain('advisoryCheck');
  });
});
