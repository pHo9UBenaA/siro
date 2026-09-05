import { ConfigError, UsageError } from '../../src/shared/errors.ts';
import { asAbsPath, asRelPath } from '../../src/shared/paths.ts';
import type { CheckStatus, Rule } from '../../src/domain/entities/rule.ts';
import type { SiroConfig } from '../../src/domain/entities/siro-config.ts';
import type { LintResult } from '../../src/domain/entities/lint-result.ts';
import { captureIO } from '../helpers/io.ts';
import { lintCommand } from '../../src/application/commands/lint.ts';
import { lint } from '../../src/application/lint.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';

const rule = (
  id: string,
  check: () => CheckStatus = () => ({ state: 'violation', message: 'custom violation' }),
): Rule => ({
  id,
  title: id,
  description: id,
  severity: 'error',
  bindings: { npm: { file: { kind: 'npmrc', path: asRelPath('.npmrc') }, check } },
});
const options = { cwd: asAbsPath('/repo'), fs: npmGoodFs() };

it('reports custom rules from explicit configuration', async () => {
  const { io, out } = captureIO();
  expect(
    await lintCommand(
      { ...options, config: { customRules: [rule('custom')] }, reporter: 'json' },
      io,
    ),
  ).toBe(1);
  const result: LintResult = JSON.parse(out());
  expect(result.findings.filter((f) => f.ruleId === 'custom')).toMatchObject([
    { message: 'custom violation', severity: 'error' },
  ]);
});

it.each(['constructor', 'prototype', '__proto__', 'toString', 'hasOwnProperty'])(
  'uses only own severity settings for a custom rule named %s',
  (id) => {
    const unconfigured = lint({ ...options, config: { customRules: [rule(id)], rules: {} } });
    expect(unconfigured.findings.find((f) => f.ruleId === id)?.severity).toBe('error');
    const configured = lint({
      ...options,
      config: { customRules: [rule(id)], rules: { [id]: 'warn' } },
    });
    expect(configured.findings.find((f) => f.ruleId === id)?.severity).toBe('warn');
  },
);

it.each([
  { customRules: [rule('provenance')] },
  { customRules: [rule('dup'), rule('dup'), rule('dup')] },
  { rules: { 'typo-one': 'off', 'typo-two': 'error' } },
] satisfies SiroConfig[])('rejects ambiguous or unknown rule IDs: %j', (config) => {
  expect(() => lint({ ...options, config })).toThrow(ConfigError);
});

it('lists each duplicate once and lists every unknown rule ID', () => {
  expect(() =>
    lint({ ...options, config: { customRules: [rule('dup'), rule('dup'), rule('dup')] } }),
  ).toThrow("Duplicate rule ids: 'dup'");
  expect(() =>
    lint({ ...options, config: { rules: { 'typo-one': 'off', 'typo-two': 'warn' } } }),
  ).toThrow("Unknown rule ids: 'typo-one', 'typo-two'");
});

it.each([
  { customRules: new Array(1) },
  { customRules: [null] },
  { reporters: new Array(1) },
  { reporters: [{ name: 'broken' }] },
  { reporters: {} },
])('rejects malformed extensions in configuration: %j', (config) => {
  expect(() => lint({ ...options, config: config as unknown as SiroConfig })).toThrow(ConfigError);
});

it.each([
  {},
  { state: 'violation', message: 'x', severity: 'fatal' },
  { state: 'violation', message: 'x', expected: {} },
  { state: 'violation', message: 'x', expected: NaN },
  { state: 'violation', message: 'x', manualSteps: ['legacy'] },
])('rejects invalid extension check results: %j', (status) => {
  expect(() =>
    lint({ ...options, config: { customRules: [rule('invalid', () => status as CheckStatus)] } }),
  ).toThrow("Rule 'invalid' returned an invalid check result.");
});

it('resolves a configured reporter and passes it the filtered result', async () => {
  const format = vi.fn<import('../../src/domain/ports/reporter.ts').Reporter['format']>();
  const { io } = captureIO();
  const config: SiroConfig = {
    customRules: [rule('custom')],
    reporters: [{ name: 'capture', format }],
  };
  expect(await lintCommand({ ...options, config, reporter: 'capture' }, io)).toBe(1);
  expect(format).toHaveBeenCalledWith(
    expect.objectContaining({
      findings: expect.arrayContaining([expect.objectContaining({ ruleId: 'custom' })]),
    }),
    io,
  );
});

it.each(['unknown', { name: 'broken' }])(
  'rejects an invalid reporter selection: %j',
  async (reporter) => {
    await expect(
      lintCommand({ ...options, reporter: reporter as never }, captureIO().io),
    ).rejects.toThrow(UsageError);
  },
);

it('rejects legacy extension options instead of silently ignoring their policies', () => {
  expect(() => lint({ ...options, customRules: [rule('legacy')] } as never)).toThrow(
    /inside the config option/u,
  );
});

it('keeps the lint exit decision independent of reporter mutations', async () => {
  const exitCode = await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      fs: { exists: () => false, readText: () => undefined },
      reporter: {
        name: 'mutating',
        format(result) {
          for (const finding of result.findings) Reflect.set(finding, 'severity', 'info');
        },
      },
    },
    captureIO().io,
  );
  expect(exitCode).toBe(1);
});
