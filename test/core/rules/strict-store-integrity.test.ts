import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { strictStoreIntegrity } from '../../../src/core/rules/strict-store-integrity.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const { aube } = strictStoreIntegrity.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('strict-store-integrity: check states', () => {
  it.each<ParsedConfig>([
    { paranoid: true, verifyStoreIntegrity: false },
    { strictStoreIntegrity: true, verifyStoreIntegrity: false },
  ])('requires manual verification restoration despite strict settings: %j', (config) => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), config)).toMatchObject({
      actual: false,
      expected: true,
      remediation: {
        kind: 'manual',
        steps: [expect.stringMatching(/verifyStoreIntegrity: true/u)],
      },
      state: 'violation',
    });
  });

  it.each<ParsedConfig>([{ paranoid: true, strictStoreIntegrity: false }])(
    'accepts paranoid despite individual settings: %j',
    (config) => {
      expect.hasAssertions();
      expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
    },
  );

  it.each<ParsedConfig>([{ strictStoreIntegrity: true }])(
    'passes when strictStoreIntegrity is true and verification remains enabled: %j',
    (config) => {
      expect.hasAssertions();
      expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
    },
  );

  it.each<ParsedConfig>([{ strictStoreIntegrity: false, verifyStoreIntegrity: true }])(
    'flags a violation when strictStoreIntegrity is false: %j',
    (config) => {
      expect.hasAssertions();
      const status = aubeBinding.check(makeCtx(), config);
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );
});

describe('strict-store-integrity: scope, metadata, and fix', () => {
  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBe(undefined);

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['strictStoreIntegrity'],
        op: 'setKey',
        value: true,
      },
    ]);
    expect(Object.keys(strictStoreIntegrity.bindings).sort()).toEqual(['aube']);

    expect(strictStoreIntegrity.severity).toBe('warn');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });
});
