import { automaticOperations } from '../../helpers/remediation.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { advisoryCheck } from '../../../src/domain/rules/advisory-check.ts';

const { aube } = advisoryCheck.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('advisory-check: check states', () => {
  it.each<ParsedConfig>([{ paranoid: true }, { advisoryCheck: 'off', paranoid: true }])(
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

  it.each<ParsedConfig>([{}, { paranoid: false }])(
    'recommends pinning the documented default when paranoid is not enabled: %j',
    (config) => {
      expect.hasAssertions();
      const status = aubeBinding.check(makeCtx(), config);
      assert(status.state === 'violation');
      expect(status.severity).toBe('info');
    },
  );

  it('flags a violation when advisoryCheck is off', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { advisoryCheck: 'off' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('advisory-check: scope, metadata, and fix', () => {
  it('only binds to aube', () => {
    expect.hasAssertions();
    expect(advisoryCheck.bindings.npm).toBeUndefined();
    expect(advisoryCheck.bindings.pnpm).toBeUndefined();
    expect(advisoryCheck.bindings.yarn).toBeUndefined();
    expect(advisoryCheck.bindings.bun).toBeUndefined();
    expect(advisoryCheck.bindings.deno).toBeUndefined();
    expect(advisoryCheck.bindings.aube).toBeDefined();
  });

  it('ships at warn severity and targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(advisoryCheck.severity).toBe('warn');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('violation message mentions advisoryCheck', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: aubeBinding,
      ctx: makeCtx(),
      substrings: ['advisoryCheck'],
    });
  });

  it('fix returns setKey op for advisoryCheck: on', () => {
    expect.hasAssertions();
    const ops = automaticOperations(aubeBinding.check(makeCtx(), {}));
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['advisoryCheck'],
        op: 'setKey',
        value: 'on',
      },
    ]);
  });
});
