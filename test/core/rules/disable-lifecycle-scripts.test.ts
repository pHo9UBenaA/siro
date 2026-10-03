import { parsePackageJson } from '../../../src/core/contracts/package-json.ts';
import { type ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { makePublishableCtx, makeCtx } from '../../helpers/ctx.ts';
import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';
import { disableLifecycleScripts } from '../../../src/core/rules/disable-lifecycle-scripts.ts';
import { automaticOperations, manualSteps } from '../../helpers/remediation.ts';

describe('disable-lifecycle-scripts (npm)', () => {
  const ctx = makeCtx();
  const npmBinding = bindingForTest(disableLifecycleScripts, 'npm');

  it('requires and proposes ignore-scripts in .npmrc', () => {
    const status = npmBinding.check(ctx, {});

    expect(status.state).toBe('violation');

    expect(npmBinding.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['ignore-scripts'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it('flags a violation when ignore-scripts is false', () => {
    const status = npmBinding.check(ctx, { 'ignore-scripts': false });
    expect(status.state).toBe('violation');
  });

  it('passes when ignore-scripts is true', () => {
    const status = npmBinding.check(ctx, { 'ignore-scripts': true });
    expect(status.state).toBe('ok');
  });
});

describe('disable-lifecycle-scripts (pnpm): check states', () => {
  const ctx = makeCtx();
  const pnpmBinding = bindingForTest(disableLifecycleScripts, 'pnpm');

  it('returns ok when strictDepBuilds is explicitly true', () => {
    expect(pnpmBinding.check(ctx, { strictDepBuilds: true }).state).toBe('ok');
  });

  it('emits a full-severity violation when strictDepBuilds is explicitly false', () => {
    const status = pnpmBinding.check(ctx, { strictDepBuilds: false });
    expect(status).toMatchObject({ actual: false, expected: true, state: 'violation' });
    assertCheckState(status, 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('disable-lifecycle-scripts (pnpm): bypass remediation', () => {
  const ctx = makeCtx();
  const pnpmBinding = bindingForTest(disableLifecycleScripts, 'pnpm');

  it('requires manual removal of a bypass even when strictDepBuilds is true', () => {
    const status = pnpmBinding.check(ctx, {
      dangerouslyAllowAllBuilds: true,
      strictDepBuilds: true,
    });
    expect(status).toMatchObject({
      actual: true,
      expected: false,
      state: 'violation',
    });
    assertCheckState(status, 'violation');
    const steps = manualSteps(status);
    expect(steps[0]).toMatch(/dangerouslyAllowAllBuilds/u);
    expect(status.message).toMatch(/dangerouslyAllowAllBuilds/u);
    expect(
      pnpmBinding.check(ctx, { dangerouslyAllowAllBuilds: false, strictDepBuilds: true }).state,
    ).toBe('ok');
  });

  it('proposes strictDepBuilds in pnpm-workspace.yaml when no bypass is present', () => {
    const operations = automaticOperations(pnpmBinding.check(ctx, {}));
    expect(operations).toStrictEqual([
      {
        file: { kind: 'yaml', path: 'pnpm-workspace.yaml' },
        keyPath: ['strictDepBuilds'],
        op: 'setKey',
        value: true,
      },
    ]);

    expect(pnpmBinding.file).toStrictEqual({ kind: 'yaml', path: 'pnpm-workspace.yaml' });
  });
});

it.each([
  ['10.5.0', /future-version bypass/, true],
  ['10.6.0', /future-version bypass/, false],
  ['10.8.0', /future-version bypass/, false],
  ['10.9.0', /bypasses strictDepBuilds/, false],
  ['11.0.0', /bypasses strictDepBuilds/, false],
  [undefined, /bypasses strictDepBuilds/, false],
] as const)(
  'keeps lifecycle bypass guidance valid for pnpm %s',
  (pmVersion, message, needsUpgrade) => {
    const status = bindingForTest(disableLifecycleScripts, 'pnpm').check(makeCtx({ pmVersion }), {
      dangerouslyAllowAllBuilds: true,
      strictDepBuilds: false,
    });
    expect(status).toMatchObject({ state: 'violation', actual: true, expected: false, message });
    const steps = manualSteps(status);
    const upgradeRequirement = 'strictDepBuilds requires pnpm >=10.6.0';
    const withUpgrade = expect.stringContaining(upgradeRequirement);
    const withoutUpgrade = expect.not.stringContaining(upgradeRequirement);
    expect(steps.join(' ')).toEqual(needsUpgrade ? withUpgrade : withoutUpgrade);
    expect(steps.join(' ')).toContain('dangerouslyAllowAllBuilds');
  },
);

it('accepts pnpm ignoreScripts even when approval settings would otherwise allow builds', () => {
  expect(
    bindingForTest(disableLifecycleScripts, 'pnpm').check(makeCtx(), {
      ignoreScripts: true,
      strictDepBuilds: false,
      dangerouslyAllowAllBuilds: true,
    }),
  ).toEqual({ state: 'ok' });
});

describe('disable-lifecycle-scripts (aube)', () => {
  it('accepts paranoid despite individual settings', () => {
    const config: ParsedConfig = { jailBuilds: false, strictDepBuilds: false };

    const ruleBinding = bindingForTest(disableLifecycleScripts, 'aube');

    expect(ruleBinding.check(makePublishableCtx(), { ...config, paranoid: true }).state).toBe('ok');
  });

  it('proposes jailBuilds and strictDepBuilds in their separate configuration files', () => {
    const ruleBinding = bindingForTest(disableLifecycleScripts, 'aube');

    expect(ruleBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
    const status = ruleBinding.check(makePublishableCtx(), {});
    assertCheckState(status, 'violations');
    expect(status.violations.map((item) => item.file)).toEqual(['aube-workspace.yaml', '.npmrc']);
    const operations = status.violations.flatMap(automaticOperations);
    const aubeFile = { kind: 'yaml', path: 'aube-workspace.yaml' };
    expect(operations).toStrictEqual([
      { file: aubeFile, keyPath: ['jailBuilds'], op: 'setKey', value: true },
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        keyPath: ['strictDepBuilds'],
        op: 'setKey',
        value: true,
      },
    ]);
  });

  it.each([
    [{ jailBuilds: true }, {}, '.npmrc', 'strictDepBuilds'],
    [{}, { strictDepBuilds: true }, 'aube-workspace.yaml', 'jailBuilds'],
  ] as const)(
    'proposes only the independently missing Aube control: %j %j',
    (yaml, npm, file, key) => {
      const status = bindingForTest(disableLifecycleScripts, 'aube').check(
        makePublishableCtx({ readConfig: () => npm }),
        yaml,
      );
      expect(status).toMatchObject({ state: 'violation', file });
      expect(automaticOperations(status)).toEqual([
        {
          file: { path: file, kind: file === '.npmrc' ? 'npmrc' : 'yaml' },
          keyPath: [key],
          op: 'setKey',
          value: true,
        },
      ]);
    },
  );

  it('keeps the independent Aube proposal automatic when the other file needs manual repair', () => {
    const status = bindingForTest(disableLifecycleScripts, 'aube').check(makePublishableCtx(), {
      jailBuilds: { nested: true },
    });
    assertCheckState(status, 'violations');
    expect(status.violations.map((item) => [item.file, item.remediation?.kind])).toEqual([
      ['aube-workspace.yaml', 'manual'],
      ['.npmrc', 'automatic'],
    ]);
  });
});

describe('disable-lifecycle-scripts (bun)', () => {
  it('reports missing Bun script policy with opt-out guidance and a proposal', () => {
    const ruleBinding = bindingForTest(disableLifecycleScripts, 'bun');

    const status = ruleBinding.check(makePublishableCtx(), {});

    expect(ruleBinding.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
    expect(ruleBinding.severity).toBe('info');

    expect(status.state).toBe('violation');

    const setKey = automaticOperations(status)[0];
    expect(setKey).toMatchObject({ keyPath: ['install', 'ignoreScripts'], value: true });

    expect(status).toMatchObject({
      message: expect.stringMatching(
        /ignoreScripts.*trustedDependencies|trustedDependencies.*ignoreScripts/u,
      ),
      state: 'violation',
    });
  });

  const ctxWithPackageJson = (pkg: unknown) => makeCtx({ packageJson: parsePackageJson(pkg) });

  describe('disable-lifecycle-scripts × bun: trustedDependencies opt-out', () => {
    const bun = bindingForTest(disableLifecycleScripts, 'bun');

    it('accepts an explicit empty trustedDependencies allow-list', () => {
      const context = ctxWithPackageJson({ name: 'x', trustedDependencies: [] });
      expect(bun.check(context, {})).toStrictEqual({ state: 'ok' });
    });

    it('still flags a non-empty trustedDependencies list when ignoreScripts is unset', () => {
      const context = ctxWithPackageJson({ name: 'x', trustedDependencies: ['esbuild'] });
      expect(bun.check(context, {}).state).toBe('violation');
    });

    it('accepts install.ignoreScripts = true regardless of package.json', () => {
      const context = ctxWithPackageJson({ name: 'x', trustedDependencies: ['esbuild'] });
      expect(bun.check(context, { install: { ignoreScripts: true } })).toStrictEqual({
        state: 'ok',
      });
    });
  });
});

describe('disable-lifecycle-scripts (yarn)', () => {
  it('requires enableScripts: false', () => {
    const ruleBinding = bindingForTest(disableLifecycleScripts, 'yarn');

    expect(ruleBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
    expect(ruleBinding.check(makePublishableCtx(), {}).state).toBe('violation');
    expect(ruleBinding.check(makePublishableCtx(), { enableScripts: false }).state).toBe('ok');
  });
});
