import assert from 'node:assert';
import { makeCtx } from '../../helpers/ctx.ts';
import { strictAllowScripts } from '../../../src/domain/rules/strict-allow-scripts.ts';

vi.setConfig({ testTimeout: 5000 });

const { npm } = strictAllowScripts.bindings;
assert(npm, 'expected npm binding');

describe('strict-allow-scripts', () => {
  it('passes when strict-allow-scripts is true', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), { 'strict-allow-scripts': true }).state).toBe('ok');
  });

  it('flags a violation when unset', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('flags a violation when set to false', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), { 'strict-allow-scripts': false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('only binds to npm', () => {
    expect.hasAssertions();
    expect(strictAllowScripts.bindings.npm).toBeDefined();
    expect(strictAllowScripts.bindings.yarn).toBeUndefined();
    expect(strictAllowScripts.bindings.pnpm).toBeUndefined();
    expect(strictAllowScripts.bindings.bun).toBeUndefined();
    expect(strictAllowScripts.bindings.deno).toBeUndefined();
    expect(strictAllowScripts.bindings.aube).toBeUndefined();
  });

  it('ships at warn severity and targets .npmrc', () => {
    expect.hasAssertions();
    expect(strictAllowScripts.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('fix returns setKey op for strict-allow-scripts: true', () => {
    expect.hasAssertions();
    const ops = npm.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['strict-allow-scripts'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});
