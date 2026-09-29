import assert from 'node:assert';
import { blockAutoInstall } from '../../../src/core/rules/block-auto-install.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const { bun } = blockAutoInstall.bindings;
assert(bun, 'expected bun binding');

describe('block-auto-install: check behaviour', () => {
  it('passes when install.auto is disable', () => {
    expect.hasAssertions();
    expect(bun.check(makeCtx(), { install: { auto: 'disable' } }).state).toBe('ok');
  });

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = bun.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
    expect(Object.keys(blockAutoInstall.bindings).sort()).toEqual(['bun']);

    expect(blockAutoInstall.severity).toBe('warn');
    expect(bun.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'toml', path: 'bunfig.toml' },
        keyPath: ['install', 'auto'],
        op: 'setKey',
        value: 'disable',
      },
    ]);
  });

  it('flags a violation when set to force', () => {
    expect.hasAssertions();
    const status = bun.check(makeCtx(), { install: { auto: 'force' } });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

it('accepts the Bun boolean form that disables automatic installation', () => {
  expect(bun.check(makeCtx(), { install: { auto: false } })).toEqual({ state: 'ok' });
});
