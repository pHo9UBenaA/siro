import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { enforceStrictSsl } from '../../../src/core/rules/enforce-strict-ssl.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations, manualSteps } from '../../helpers/remediation.ts';

const npmBinding = bindingForTest(enforceStrictSsl, 'npm');

const yarnBinding = bindingForTest(enforceStrictSsl, 'yarn');

describe('enforce-strict-ssl (npm)', () => {
  it('passes when strict-ssl is true', () => {
    expect(npmBinding.check(makeCtx(), { 'strict-ssl': true }).state).toBe('ok');
  });

  it('reports the npm default as info and proposes explicit TLS verification', () => {
    const status = npmBinding.check(makeCtx(), {});

    expect(status).toMatchObject({ state: 'violation', severity: 'info' });

    expect(npmBinding.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['strict-ssl'],
        op: 'setKey',
        value: true,
      },
    ]);

    expect(Object.keys(enforceStrictSsl.bindings).sort()).toEqual(['npm', 'yarn']);

    expect(enforceStrictSsl.severity).toBe('warn');
  });

  it('flags a violation when set to false', () => {
    const status = npmBinding.check(makeCtx(), { 'strict-ssl': false });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('enforce-strict-ssl (yarn) — check states', () => {
  it.each([{}, { unsafeHttpWhitelist: [] }])(
    'accepts strict TLS without HTTP exceptions: %j',
    (config) => {
      expect(yarnBinding.check(makeCtx(), { enableStrictSsl: true, ...config }).state).toBe('ok');
    },
  );

  it('flags a violation when enableStrictSsl is false', () => {
    const status = yarnBinding.check(makeCtx(), { enableStrictSsl: false });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
    expect(status.expected).toBe(true);
    expect(status.actual).toBe(false);
  });

  it('flags a violation when enableStrictSsl is a string', () => {
    expect(yarnBinding.check(makeCtx(), { enableStrictSsl: 'false' }).state).toBe('violation');
  });

  it('reports the Yarn default as info and proposes explicit TLS verification', () => {
    const status = yarnBinding.check(makeCtx(), {});

    assertCheckState(status, 'violation');
    expect(status.severity).toBe('info');

    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: '.yarnrc.yml' },
        keyPath: ['enableStrictSsl'],
        op: 'setKey',
        value: true,
      },
    ]);
  });
});

describe('enforce-strict-ssl (yarn) — HTTP exception remediation', () => {
  it('requires manual review when unsafeHttpWhitelist is non-empty', () => {
    const status = yarnBinding.check(makeCtx(), {
      enableStrictSsl: true,
      unsafeHttpWhitelist: ['internal.example.com'],
    });
    assertCheckState(status, 'violation');
    const steps = manualSteps(status);
    expect(steps[0]).toMatch(/unsafeHttpWhitelist/u);
  });

  it('requires both HTTP exception removal and TLS restoration', () => {
    const status = yarnBinding.check(makeCtx(), {
      enableStrictSsl: false,
      unsafeHttpWhitelist: ['example.com'],
    });
    assertCheckState(status, 'violation');
    expect(status.remediation).toMatchObject({ kind: 'manual' });
    expect(manualSteps(status)[0]).toMatch(/unsafeHttpWhitelist.*enableStrictSsl/u);
  });
});
