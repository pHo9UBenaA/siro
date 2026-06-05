import assert from 'node:assert';
import { enforceStrictSsl } from '../../../src/domain/rules/enforce-strict-ssl.ts';
import { expectDocumentedDefaultDynamicInfo } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';

vi.setConfig({ testTimeout: 5000 });

const npmBinding = enforceStrictSsl.bindings.npm;
assert(npmBinding, 'expected npm binding');
const yarnBinding = enforceStrictSsl.bindings.yarn;
assert(yarnBinding, 'expected yarn binding');

describe('enforce-strict-ssl (npm)', () => {
  it('passes when strict-ssl is true', () => {
    expect.hasAssertions();
    expect(npmBinding.check(makeCtx(), { 'strict-ssl': true }).state).toBe('ok');
  });

  it('treats unset as documentedDefault info advisory', () => {
    expect.hasAssertions();
    expectDocumentedDefaultDynamicInfo(npmBinding, makeCtx());
  });

  it('flags a violation when set to false', () => {
    expect.hasAssertions();
    const status = npmBinding.check(makeCtx(), { 'strict-ssl': false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });

  it('targets .npmrc', () => {
    expect.hasAssertions();
    expect(npmBinding.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('fix returns setKey op for strict-ssl: true', () => {
    expect.hasAssertions();
    const ops = npmBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['strict-ssl'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});

describe('enforce-strict-ssl (yarn) — check states', () => {
  it('passes when enableStrictSsl is true and no whitelist', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), { enableStrictSsl: true }).state).toBe('ok');
  });

  it('passes when enableStrictSsl is true and whitelist is empty', () => {
    expect.hasAssertions();
    expect(
      yarnBinding.check(makeCtx(), { enableStrictSsl: true, unsafeHttpWhitelist: [] }).state,
    ).toBe('ok');
  });

  it('flags a violation when enableStrictSsl is false', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), { enableStrictSsl: false });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
    expect(status.expected).toBe(true);
    expect(status.actual).toBe(false);
  });

  it('emits info advisory when enableStrictSsl is unset', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBe('info');
  });
});

describe('enforce-strict-ssl (yarn) — whitelist and fix', () => {
  it('flags a violation with manualSteps when unsafeHttpWhitelist is non-empty', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), {
      enableStrictSsl: true,
      unsafeHttpWhitelist: ['internal.example.com'],
    });
    assert(status.state === 'violation');
    expect(status.manualSteps).toBeDefined();
    const FIRST_ELEMENT = 0;
    assert(status.manualSteps, 'expected manualSteps');
    expect(status.manualSteps[FIRST_ELEMENT]).toMatch(/unsafeHttpWhitelist/u);
  });

  it('prioritizes enableStrictSsl=false over non-empty whitelist', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), {
      enableStrictSsl: false,
      unsafeHttpWhitelist: ['example.com'],
    });
    assert(status.state === 'violation');
    expect(status.expected).toBe(true);
    expect(status.actual).toBe(false);
  });

  it('targets .yarnrc.yml', () => {
    expect.hasAssertions();
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
  });

  it('fix returns setKey op for enableStrictSsl: true', () => {
    expect.hasAssertions();
    const ops = yarnBinding.fix(makeCtx());
    expect(ops).toStrictEqual([
      {
        file: { kind: 'yaml', path: '.yarnrc.yml' },
        keyPath: ['enableStrictSsl'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});

describe('enforce-strict-ssl (binding scope)', () => {
  it('binds to npm and yarn only', () => {
    expect.hasAssertions();
    expect(enforceStrictSsl.bindings.npm).toBeDefined();
    expect(enforceStrictSsl.bindings.yarn).toBeDefined();
    expect(enforceStrictSsl.bindings.pnpm).toBeUndefined();
    expect(enforceStrictSsl.bindings.bun).toBeUndefined();
    expect(enforceStrictSsl.bindings.deno).toBeUndefined();
    expect(enforceStrictSsl.bindings.aube).toBeUndefined();
  });

  it('ships at warn severity', () => {
    expect.hasAssertions();
    expect(enforceStrictSsl.severity).toBe('warn');
  });
});
