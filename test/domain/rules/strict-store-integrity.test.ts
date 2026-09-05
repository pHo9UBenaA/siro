import { automaticOperations } from '../../helpers/remediation.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { strictStoreIntegrity } from '../../../src/domain/rules/strict-store-integrity.ts';

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

  it.each<ParsedConfig>([
    { paranoid: true },
    { paranoid: true, strictStoreIntegrity: false },
    { paranoid: true, verifyStoreIntegrity: true },
  ])('accepts paranoid despite individual settings: %j', (config) => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it.each<ParsedConfig>([
    { strictStoreIntegrity: true },
    { strictStoreIntegrity: true, verifyStoreIntegrity: true },
  ])('passes when strictStoreIntegrity is true and verification remains enabled: %j', (config) => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it.each<ParsedConfig>([{}, { paranoid: false }])(
    'requires the individual setting when paranoid is not enabled: %j',
    (config) => {
      expect.hasAssertions();
      const status = aubeBinding.check(makeCtx(), config);
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );

  it.each<ParsedConfig>([
    { strictStoreIntegrity: false },
    { strictStoreIntegrity: false, verifyStoreIntegrity: true },
  ])('flags a violation when strictStoreIntegrity is false: %j', (config) => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), config);
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('strict-store-integrity: scope, metadata, and fix', () => {
  it('only binds to aube', () => {
    expect.hasAssertions();
    expect(strictStoreIntegrity.bindings.npm).toBeUndefined();
    expect(strictStoreIntegrity.bindings.pnpm).toBeUndefined();
    expect(strictStoreIntegrity.bindings.yarn).toBeUndefined();
    expect(strictStoreIntegrity.bindings.bun).toBeUndefined();
    expect(strictStoreIntegrity.bindings.deno).toBeUndefined();
    expect(strictStoreIntegrity.bindings.aube).toBeDefined();
  });

  it('ships at warn severity and targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(strictStoreIntegrity.severity).toBe('warn');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('fix returns setKey op for strictStoreIntegrity: true', () => {
    expect.hasAssertions();
    const ops = automaticOperations(aubeBinding.check(makeCtx(), {}));
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['strictStoreIntegrity'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
