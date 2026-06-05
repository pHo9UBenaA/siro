import assert from 'node:assert';
import { blockAutoInstall } from '../../../src/domain/rules/block-auto-install.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

const { bun } = blockAutoInstall.bindings;
assert(bun, 'expected bun binding');

describe('block-auto-install: check behaviour', () => {
  it('passes when install.auto is disable', () => {
    expect.hasAssertions();
    expect(bun.check(makeCtx(), { install: { auto: 'disable' } }).state).toBe('ok');
  });

  it('flags a violation when unset', () => {
    expect.hasAssertions();
    const status = bun.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when set to auto', () => {
    expect.hasAssertions();
    const status = bun.check(makeCtx(), { install: { auto: 'auto' } });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when set to force', () => {
    expect.hasAssertions();
    const status = bun.check(makeCtx(), { install: { auto: 'force' } });
    expect(status.state).toBe('violation');
  });

  it('flags a violation when set to fallback', () => {
    expect.hasAssertions();
    const status = bun.check(makeCtx(), { install: { auto: 'fallback' } });
    expect(status.state).toBe('violation');
  });
});

describe('block-auto-install: scope, metadata, and fix', () => {
  it('only binds to bun', () => {
    expect.hasAssertions();
    expect(blockAutoInstall.bindings.bun).toBeDefined();
    expect(blockAutoInstall.bindings.npm).toBeUndefined();
    expect(blockAutoInstall.bindings.yarn).toBeUndefined();
    expect(blockAutoInstall.bindings.pnpm).toBeUndefined();
    expect(blockAutoInstall.bindings.deno).toBeUndefined();
    expect(blockAutoInstall.bindings.aube).toBeUndefined();
  });

  it('ships at warn severity and targets bunfig.toml', () => {
    expect.hasAssertions();
    expect(blockAutoInstall.severity).toBe('warn');
    expect(bun.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
  });

  it('fix returns setKey op for install.auto: disable', () => {
    expect.hasAssertions();
    const ops = bun.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'toml', path: 'bunfig.toml' },
        keyPath: ['install', 'auto'],
        op: 'setKey',
        value: 'disable',
      },
    ]);
  });
});
