import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { strictReleaseAge } from '../../../src/core/rules/strict-release-age.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const aubeBinding = bindingForTest(strictReleaseAge, 'aube');

describe('strict-release-age: check states', () => {
  it('accepts paranoid despite individual settings', () => {
    const config: ParsedConfig = { minimumReleaseAgeStrict: false, paranoid: true };

    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it('passes when minimumReleaseAgeStrict is true', () => {
    expect(aubeBinding.check(makeCtx(), { minimumReleaseAgeStrict: true }).state).toBe('ok');
  });

  it('flags a violation when minimumReleaseAgeStrict is false', () => {
    expect(aubeBinding.check(makeCtx(), { minimumReleaseAgeStrict: false }).state).toBe(
      'violation',
    );
  });
});

describe('strict-release-age: scope, metadata, and fix', () => {
  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['minimumReleaseAgeStrict'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
