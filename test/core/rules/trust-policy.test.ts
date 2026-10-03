import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { trustPolicy } from '../../../src/core/rules/trust-policy.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const pnpmBinding = bindingForTest(trustPolicy, 'pnpm');

describe('trust-policy: check states', () => {
  it('passes when trustPolicy is no-downgrade', () => {
    expect(pnpmBinding.check(makeCtx(), { trustPolicy: 'no-downgrade' }).state).toBe('ok');
  });

  it('requires and proposes pnpm trust policy with its supported scope', () => {
    const status = pnpmBinding.check(makeCtx(), {});

    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();

    expect(trustPolicy.severity).toBe('warn');
    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });

    expect(Object.keys(trustPolicy.bindings).sort()).toEqual(['aube', 'pnpm']);

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'pnpm-workspace.yaml' },
        keyPath: ['trustPolicy'],
        op: 'setKey',
        value: 'no-downgrade',
      },
    ]);
  });

  it('flags trustPolicy off even with the aube-only paranoid option enabled', () => {
    const status = pnpmBinding.check(makeCtx(), { paranoid: true, trustPolicy: 'off' });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });
});

const aubeBinding = bindingForTest(trustPolicy, 'aube');

describe('trust-policy: aube binding', () => {
  it('accepts paranoid despite individual settings', () => {
    const config: ParsedConfig = { paranoid: true, trustPolicy: 'off' };

    expect(aubeBinding.check(makeCtx(), config).state).toBe('ok');
  });

  it('passes when trustPolicy is no-downgrade', () => {
    expect(aubeBinding.check(makeCtx(), { trustPolicy: 'no-downgrade' }).state).toBe('ok');
  });

  it('proposes Aube trust policy in its workspace configuration', () => {
    const operations = automaticOperations(aubeBinding.check(makeCtx(), {}));
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['trustPolicy'],
        op: 'setKey',
        value: 'no-downgrade',
      },
    ]);

    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });
});
