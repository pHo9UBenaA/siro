import assert from 'node:assert';
import {
  expectDocumentedDefaultDynamicInfo,
  expectMessageContains,
} from '../../helpers/binding-expectations.ts';
import { blockExoticSubdeps } from '../../../src/domain/rules/block-exotic-subdeps.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

const { pnpm } = blockExoticSubdeps.bindings;
assert(pnpm, 'expected pnpm binding');

describe('block-exotic-subdeps', () => {
  it('passes when blockExoticSubdeps is explicitly true', () => {
    expect.hasAssertions();
    expect(pnpm.check(makeCtx(), { blockExoticSubdeps: true }).state).toBe('ok');
  });

  it('treats unset key as a documentedDefault info advisory', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(pnpm, makeCtx());
  });

  it('flags a warn violation when explicitly set to false', () => {
    expect.hasAssertions();
    const status = pnpm.check(makeCtx(), { blockExoticSubdeps: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('binds to pnpm, npm, and aube', () => {
    expect.hasAssertions();
    expect(blockExoticSubdeps.bindings.pnpm).toBeDefined();
    expect(blockExoticSubdeps.bindings.npm).toBeDefined();
    expect(blockExoticSubdeps.bindings.aube).toBeDefined();
    expect(blockExoticSubdeps.bindings.yarn).toBeUndefined();
    expect(blockExoticSubdeps.bindings.bun).toBeUndefined();
    expect(blockExoticSubdeps.bindings.deno).toBeUndefined();
  });

  it('ships at warn severity and targets pnpm-workspace.yaml', () => {
    expect.hasAssertions();
    expect(blockExoticSubdeps.severity).toBe('warn');
    expect(pnpm.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });

  it('includes version note in violation message', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: pnpm,
      ctx: makeCtx(),
      substrings: ['available since pnpm 10.26.0'],
    });
  });

  it('fix returns setKey op for blockExoticSubdeps: true', () => {
    expect.hasAssertions();
    const ops = pnpm.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'pnpm-workspace.yaml' },
        keyPath: ['blockExoticSubdeps'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});

const { aube } = blockExoticSubdeps.bindings;
assert(aube, 'expected aube binding');

describe('block-exotic-subdeps (aube)', () => {
  it('passes when blockExoticSubdeps is explicitly true', () => {
    expect.hasAssertions();
    expect(aube.check(makeCtx(), { blockExoticSubdeps: true }).state).toBe('ok');
  });

  it('treats unset key as a documentedDefault info advisory', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(aube, makeCtx());
  });

  it('flags a warn violation when explicitly set to false', () => {
    expect.hasAssertions();
    const status = aube.check(makeCtx(), { blockExoticSubdeps: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('targets aube-workspace.yaml', () => {
    expect.hasAssertions();
    expect(aube.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
  });

  it('fix returns setKey op for blockExoticSubdeps: true', () => {
    expect.hasAssertions();
    const ops = aube.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['blockExoticSubdeps'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});

const { npm } = blockExoticSubdeps.bindings;
if (!npm) {
  throw new TypeError('expected npm binding');
}

describe('block-exotic-subdeps (npm)', () => {
  it('targets .npmrc', () => {
    expect.hasAssertions();
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('passes when both allow-git and allow-remote are root', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), { 'allow-git': 'root', 'allow-remote': 'root' }).state).toBe('ok');
  });

  it('passes when both are none', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), { 'allow-git': 'none', 'allow-remote': 'none' }).state).toBe('ok');
  });

  it('flags a violation when allow-git is all (default)', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), { 'allow-git': 'all', 'allow-remote': 'root' });
    expect(status.state).toBe('violation');
  });

  it('flags a violation when allow-remote is all', () => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), { 'allow-git': 'root', 'allow-remote': 'all' });
    expect(status.state).toBe('violation');
  });

  it('flags a violation when both keys are unset', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), {}).state).toBe('violation');
  });

  it('fix sets both allow-git and allow-remote to root', () => {
    expect.hasAssertions();
    const ops = npm.fix(makeCtx());
    const npmrcFile = { kind: 'npmrc', path: '.npmrc' };
    expect(ops).toStrictEqual([
      { file: npmrcFile, keyPath: ['allow-git'], op: 'setKey', value: 'root' },
      { file: npmrcFile, keyPath: ['allow-remote'], op: 'setKey', value: 'root' },
    ]);
  });
});
