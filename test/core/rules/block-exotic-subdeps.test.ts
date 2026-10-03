import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import type { ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { blockExoticSubdeps } from '../../../src/core/rules/block-exotic-subdeps.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';

const pnpm = bindingForTest(blockExoticSubdeps, 'pnpm');

describe('block-exotic-subdeps', () => {
  it('passes when blockExoticSubdeps is explicitly true', () => {
    expect(pnpm.check(makeCtx(), { blockExoticSubdeps: true }).state).toBe('ok');
  });

  it('leaves explicit false at the rule severity', () => {
    const status = pnpm.check(makeCtx(), { blockExoticSubdeps: false });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('proposes pnpm URL restrictions with the supported binding scope', () => {
    const operations = automaticOperations(pnpm.check(makeCtx(), {}));
    expect(operations).toStrictEqual([
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

const aube = bindingForTest(blockExoticSubdeps, 'aube');

describe('block-exotic-subdeps (aube)', () => {
  it('passes when blockExoticSubdeps is explicitly true', () => {
    expect(aube.check(makeCtx(), { blockExoticSubdeps: true }).state).toBe('ok');
  });

  it('reports the Aube default as info and proposes explicit restrictions', () => {
    const status = aube.check(makeCtx(), {});

    expect(status).toMatchObject({ state: 'violation', severity: 'info' });

    expect(aube.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'aube-workspace.yaml' },
        keyPath: ['blockExoticSubdeps'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it('leaves explicit false at the rule severity', () => {
    const status = aube.check(makeCtx(), { blockExoticSubdeps: false });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });
});

const npm = bindingForTest(blockExoticSubdeps, 'npm');

describe('block-exotic-subdeps (npm)', () => {
  it('passes when both allow-git and allow-remote are root', () => {
    expect(npm.check(makeCtx(), { 'allow-git': 'root', 'allow-remote': 'root' }).state).toBe('ok');
  });

  it('passes when both are none', () => {
    expect(npm.check(makeCtx(), { 'allow-git': 'none', 'allow-remote': 'none' }).state).toBe('ok');
  });

  it.each<ParsedConfig>([
    { 'allow-git': 'all', 'allow-remote': 'root' },
    { 'allow-git': 'root', 'allow-remote': 'all' },
  ])('keeps full severity when either URL restriction is explicitly unsafe (%j)', (config) => {
    const status = npm.check(makeCtx(), config);
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });

  it.each<ParsedConfig>([{ 'allow-git': 'root' }, { 'allow-remote': 'root' }])(
    'keeps unset URL restrictions at full severity when npm 12 is unverified (%j)',
    (config) => {
      const status = npm.check(makeCtx(), config);
      assertCheckState(status, 'violation');
      expect(status.expected).toBe('none');
      expect(status.severity).toBeUndefined();
    },
  );

  it('proposes both npm URL restrictions in .npmrc', () => {
    const operations = automaticOperations(npm.check(makeCtx(), {}));
    const npmrcFile = { kind: 'npmrc', path: '.npmrc' };
    expect(operations).toStrictEqual([
      { file: npmrcFile, keyPath: ['allow-git'], op: 'setKey', value: 'none' },
      { file: npmrcFile, keyPath: ['allow-remote'], op: 'setKey', value: 'none' },
    ]);

    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });
});
