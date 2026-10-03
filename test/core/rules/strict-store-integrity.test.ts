import { bindingForTest } from '../../helpers/rules.ts';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { strictStoreIntegrity } from '../../../src/core/rules/strict-store-integrity.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const aubeBinding = bindingForTest(strictStoreIntegrity, 'aube');

describe('strict-store-integrity: check states', () => {
  it.each<ParsedConfig>([
    { paranoid: true, verifyStoreIntegrity: false },
    { strictStoreIntegrity: true, verifyStoreIntegrity: false },
  ])('requires manual verification restoration despite strict settings: %j', (config) => {
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

  it('accepts paranoid despite individual settings', () => {
    const config: ParsedConfig = { paranoid: true, strictStoreIntegrity: false };

    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it('passes when strictStoreIntegrity is true and verification remains enabled', () => {
    const config: ParsedConfig = { strictStoreIntegrity: true };

    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it('flags a violation when strictStoreIntegrity is false', () => {
    const config: ParsedConfig = { strictStoreIntegrity: false, verifyStoreIntegrity: true };

    expect(aubeBinding.check(makeCtx(), config).state).toBe('violation');
  });
});

describe('strict-store-integrity: remediation', () => {
  it('proposes strictStoreIntegrity in aube-workspace.yaml', () => {
    const status = aubeBinding.check(makeCtx(), {});
    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['strictStoreIntegrity'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
