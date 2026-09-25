import assert from 'node:assert';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { blockExoticSubdeps } from '../../../src/core/rules/block-exotic-subdeps.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const { pnpm } = blockExoticSubdeps.bindings;
assert(pnpm, 'expected pnpm binding');

describe('block-exotic-subdeps', () => {
  it('passes when blockExoticSubdeps is explicitly true', () => {
    expect.hasAssertions();
    expect(pnpm.check(makeCtx(), { blockExoticSubdeps: true }).state).toBe('ok');
  });

  it('flags a warn violation when explicitly set to false', () => {
    expect.hasAssertions();
    const status = pnpm.check(makeCtx(), { blockExoticSubdeps: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('proposes pnpm URL restrictions with the supported binding scope', () => {
    const ops = automaticOperations(pnpm.check(makeCtx(), {}));
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'pnpm-workspace.yaml' },
        keyPath: ['blockExoticSubdeps'],
        op: 'setKey',
        value: true,
      },
    ]);

    expect(blockExoticSubdeps.severity).toBe('warn');
    expect(pnpm.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });

    expect(Object.keys(blockExoticSubdeps.bindings).sort()).toEqual(['aube', 'npm', 'pnpm']);
  });
});

const { aube } = blockExoticSubdeps.bindings;
assert(aube, 'expected aube binding');

describe('block-exotic-subdeps (aube)', () => {
  it('passes when blockExoticSubdeps is explicitly true', () => {
    expect.hasAssertions();
    expect(aube.check(makeCtx(), { blockExoticSubdeps: true }).state).toBe('ok');
  });

  it('reports the Aube default as info and proposes explicit restrictions', () => {
    const status = aube.check(makeCtx(), {});

    expect(status).toMatchObject({ state: 'violation', severity: 'info' });

    expect(aube.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['blockExoticSubdeps'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it('flags a warn violation when explicitly set to false', () => {
    expect.hasAssertions();
    const status = aube.check(makeCtx(), { blockExoticSubdeps: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

const { npm } = blockExoticSubdeps.bindings;
if (!npm) {
  throw new TypeError('expected npm binding');
}

describe('block-exotic-subdeps (npm)', () => {
  it('passes when both allow-git and allow-remote are root', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), { 'allow-git': 'root', 'allow-remote': 'root' }).state).toBe('ok');
  });

  it('passes when both are none', () => {
    expect.hasAssertions();
    expect(npm.check(makeCtx(), { 'allow-git': 'none', 'allow-remote': 'none' }).state).toBe('ok');
  });

  it.each<ParsedConfig>([
    { 'allow-git': 'all', 'allow-remote': 'root' },
    { 'allow-git': 'root', 'allow-remote': 'all' },
  ])('keeps full severity when either URL restriction is explicitly unsafe (%j)', (config) => {
    expect.hasAssertions();
    const status = npm.check(makeCtx(), config);
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it.each<ParsedConfig>([{ 'allow-git': 'root' }, { 'allow-remote': 'root' }])(
    'keeps unset URL restrictions at full severity when npm 12 is unverified (%j)',
    (config) => {
      expect.hasAssertions();
      const status = npm.check(makeCtx(), config);
      expect(status).toMatchObject({ expected: 'none', state: 'violation' });
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );

  it('proposes both npm URL restrictions in .npmrc', () => {
    const ops = automaticOperations(npm.check(makeCtx(), {}));
    const npmrcFile = { kind: 'npmrc', path: '.npmrc' };
    expect(ops).toStrictEqual([
      { file: npmrcFile, keyPath: ['allow-git'], op: 'setKey', value: 'none' },
      { file: npmrcFile, keyPath: ['allow-remote'], op: 'setKey', value: 'none' },
    ]);

    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });
});
