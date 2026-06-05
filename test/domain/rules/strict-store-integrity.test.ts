import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { strictStoreIntegrity } from '../../../src/domain/rules/strict-store-integrity.ts';

vi.setConfig({ testTimeout: 5000 });

const { aube } = strictStoreIntegrity.bindings;
assert(aube, 'expected aube binding');
const aubeBinding = aube;

describe('strict-store-integrity: check states', () => {
  it('passes when strictStoreIntegrity is true', () => {
    expect.hasAssertions();
    expect(aubeBinding.check(makeCtx(), { strictStoreIntegrity: true }).state).toBe('ok');
  });

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when strictStoreIntegrity is false', () => {
    expect.hasAssertions();
    const status = aubeBinding.check(makeCtx(), { strictStoreIntegrity: false });
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
    const ops = aubeBinding.fix(makeCtx());
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
