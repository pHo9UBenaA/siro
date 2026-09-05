import { automaticOperations } from '../../helpers/remediation.ts';
import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/domain/entities/config-value.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { strictReleaseAge } from '../../../src/domain/rules/strict-release-age.ts';

const { aube } = strictReleaseAge.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('strict-release-age: check states', () => {
  it.each<ParsedConfig>([{ paranoid: true }, { minimumReleaseAgeStrict: false, paranoid: true }])(
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

  it.each<ParsedConfig>([{}, { paranoid: false }])(
    'requires the individual setting when paranoid is not enabled: %j',
    (config) => {
      expect.hasAssertions();
      const status = aubeBinding.check(makeCtx(), config);
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );

  it('flags a violation when minimumReleaseAgeStrict is false', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { minimumReleaseAgeStrict: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('strict-release-age: scope, metadata, and fix', () => {
  it('only binds to aube', () => {
    expect.hasAssertions();
    expect(strictReleaseAge.bindings.npm).toBeUndefined();
    expect(strictReleaseAge.bindings.pnpm).toBeUndefined();
    expect(strictReleaseAge.bindings.yarn).toBeUndefined();
    expect(strictReleaseAge.bindings.bun).toBeUndefined();
    expect(strictReleaseAge.bindings.deno).toBeUndefined();
    expect(strictReleaseAge.bindings.aube).toBeDefined();
  });

  it('ships at info severity and targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(strictReleaseAge.severity).toBe('info');
    expect(aubeBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('fix returns setKey op for minimumReleaseAgeStrict: true', () => {
    expect.hasAssertions();
    const ops = automaticOperations(aubeBinding.check(makeCtx(), {}));
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
