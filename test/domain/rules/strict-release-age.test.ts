import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { strictReleaseAge } from '../../../src/domain/rules/strict-release-age.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const { aube } = strictReleaseAge.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('strict-release-age: check states', () => {
  it.each<ParsedConfig>([{ minimumReleaseAgeStrict: false, paranoid: true }])(
    'accepts paranoid despite individual settings: %j',
    (config) => {
      expect.hasAssertions();
      expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
    },
  );

  it('passes when minimumReleaseAgeStrict is true', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { minimumReleaseAgeStrict: true }).state).toBe('ok');
  });

  it('flags a violation when minimumReleaseAgeStrict is false', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { minimumReleaseAgeStrict: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('strict-release-age: scope, metadata, and fix', () => {
  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBe(undefined);

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['minimumReleaseAgeStrict'],
        op: 'setKey',
        value: true,
      },
    ]);
    expect(Object.keys(strictReleaseAge.bindings).sort()).toEqual(['aube']);

    expect(strictReleaseAge.severity).toBe('info');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });
});
