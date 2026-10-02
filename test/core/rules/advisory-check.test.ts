import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { advisoryCheck } from '../../../src/core/rules/advisory-check.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const aubeBinding = bindingForTest(advisoryCheck, 'aube');

describe('advisory-check: check states', () => {
  it('accepts paranoid despite individual settings', () => {
    const config: ParsedConfig = { advisoryCheck: 'off', paranoid: true };

    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it.each(['on', 'required'])('accepts advisoryCheck=%s', (value) => {
    expect(aubeBinding.check(makeCtx(), { advisoryCheck: value }).state).toBe('ok');
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
    assert(status.state === 'violation');
    expect(status.message).toContain('advisoryCheck');
  });
});
