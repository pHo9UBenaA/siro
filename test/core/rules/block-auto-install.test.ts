import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { blockAutoInstall } from '../../../src/core/rules/block-auto-install.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const bun = bindingForTest(blockAutoInstall, 'bun');

describe('block-auto-install: check behaviour', () => {
  it('passes when install.auto is disable', () => {
    expect(bun.check(makeCtx(), { install: { auto: 'disable' } }).state).toBe('ok');
  });

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = bun.check(makeCtx(), {});

    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
    expect(Object.keys(blockAutoInstall.bindings).sort()).toEqual(['bun']);

    expect(blockAutoInstall.severity).toBe('warn');
    expect(bun.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'toml', path: 'bunfig.toml' },
        keyPath: ['install', 'auto'],
        op: 'setKey',
        value: 'disable',
      },
    ]);
  });

  it('flags a violation when set to force', () => {
    const status = bun.check(makeCtx(), { install: { auto: 'force' } });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });
});

it('accepts the Bun boolean form that disables automatic installation', () => {
  expect(bun.check(makeCtx(), { install: { auto: false } })).toEqual({ state: 'ok' });
});
