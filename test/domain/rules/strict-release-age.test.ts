import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { strictReleaseAge } from '../../../src/domain/rules/strict-release-age.ts';

vi.setConfig({ testTimeout: 5000 });

const { aube } = strictReleaseAge.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('strict-release-age: check states', () => {
  it('passes when minimumReleaseAgeStrict is true', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { minimumReleaseAgeStrict: true }).state).toBe('ok');
  });

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

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
    const ops = aubeBinding.fix(makeCtx());
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
