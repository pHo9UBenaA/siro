import { runInNewContext } from 'node:vm';
import {
  asAbsPath,
  CONFIG_FILES,
  ConfigError,
  UsageError,
  lint,
  lintCommand,
  type LintResult,
  type CheckStatus,
  type RuleBinding,
  type Rule,
  type Reporter,
  type SiroConfig,
} from '../../src/index.ts';
import { npmPassingFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';

const options = { cwd: asAbsPath('/repo'), fs: npmPassingFs() };
const rule = (
  id: string,
  check: RuleBinding['check'] = () => ({ state: 'violation', message: 'custom violation' }),
): Rule => ({
  id,
  title: id,
  description: id,
  severity: 'error',
  bindings: { npm: { file: CONFIG_FILES.npmrc, check } },
});

it('reports grouped custom findings and aggregates their final severities', async () => {
  const { io, out } = captureIO();
  expect(
    await lintCommand(
      {
        ...options,
        installationRoots: [],
        config: {
          customRules: [
            rule('custom', () => ({
              state: 'violations',
              violations: [
                { state: 'violation', message: 'error' },
                { state: 'violation', message: 'warn', severity: 'warn' },
                { state: 'violation', message: 'info', severity: 'info' },
              ],
            })),
          ],
        },
        reporter: 'json',
      },
      io,
    ),
  ).toBe(1);
  const result: LintResult = JSON.parse(out());
  expect(result.findings.filter((f) => f.ruleId === 'custom')).toMatchObject([
    { message: 'error', severity: 'error' },
    { message: 'warn', severity: 'warn' },
    { message: 'info', severity: 'info' },
  ]);
  expect(result.summary).toEqual({ error: 1, warn: 1, info: 1 });
});

it('preserves a custom actual value returned by toJSON across realms', async () => {
  const { io, out } = captureIO();
  const actual = { toJSON: () => runInNewContext('new Number(7)') };
  expect(
    await lintCommand(
      {
        ...options,
        installationRoots: [],
        reporter: 'json',
        config: {
          customRules: [
            rule('json-value', () => ({ state: 'violation', message: 'probe', actual })),
          ],
        },
      },
      io,
    ),
  ).toBe(1);
  const result: LintResult = JSON.parse(out());
  expect(result.findings.find((finding) => finding.ruleId === 'json-value')?.actual).toBe(7);
});

it('rejects non-serializable custom actual values without a successful JSON report', async () => {
  const { io, out } = captureIO();
  await expect(
    lintCommand(
      {
        ...options,
        installationRoots: [],
        reporter: 'json',
        config: {
          customRules: [
            rule('json-value', () => ({
              state: 'violation',
              message: 'probe',
              actual: Object(1n),
            })),
          ],
        },
      },
      io,
    ),
  ).rejects.toBeInstanceOf(TypeError);
  expect(out()).toBe('');
});

it.each(['constructor', '__proto__', 'ordinary'])(
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

it('rejects a custom rule ID that duplicates a builtin', () => {
  const config: SiroConfig = { customRules: [rule('provenance')] };
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
  { reporters: new Array(1) },
  { reporters: [{ name: 'broken' }] },
  { reporters: [Object.assign([], { name: 'array', format() {} })] },
  { reporters: {} },
])('rejects malformed extensions in configuration: %j', (config) => {
  expect(() => Reflect.apply(lint, undefined, [{ ...options, config }])).toThrow(ConfigError);
});

it.each([
  {},
  { state: 'violation', message: 'x', severity: 'fatal' },
  { state: 'violation', message: 'x', expected: {} },
  { state: 'violation', message: 'x', expected: NaN },
  { state: 'violation', message: 'x', manualSteps: ['legacy'] },
  { state: 'violation', message: 'x', file: '../outside' },
  { state: 'violation', message: 'x', fixable: true },
  { state: 'violation', message: 'x', fix: [] },
])('rejects invalid extension check results: %j', (status) => {
  expect(() =>
    Reflect.apply(lint, undefined, [
      {
        ...options,
        config: {
          customRules: [{ ...rule('invalid'), bindings: { npm: { check: () => status } } }],
        },
      },
    ]),
  ).toThrow("Rule 'invalid' returned an invalid check result.");
});

it.each(['unknown', { name: 'broken' }])(
  'rejects an invalid reporter selection: %j',
  async (reporter) => {
    await expect(
      Reflect.apply(lintCommand, undefined, [{ ...options, reporter }, captureIO().io]),
    ).rejects.toThrow(UsageError);
  },
);

it('rejects an unknown reporter before running any rule', async () => {
  const check = vi.fn<() => CheckStatus>(() => {
    throw new Error('Rule must not run');
  });
  await expect(
    lintCommand(
      { ...options, reporter: 'unknown', config: { customRules: [rule('unreached', check)] } },
      captureIO().io,
    ),
  ).rejects.toThrow('Unknown reporter: unknown');
  expect(check).not.toHaveBeenCalled();
});

it('propagates a rule failure without reporting a partial result', async () => {
  const failure = new Error('Rule failed');
  const format = vi.fn<Reporter['format']>();
  const commandOptions = {
    ...options,
    config: {
      customRules: [
        rule('first'),
        rule('broken', () => {
          throw failure;
        }),
      ],
    },
    reporter: { name: 'unreached', format },
  };
  await expect(lintCommand(commandOptions, captureIO().io)).rejects.toBe(failure);
  expect(format).not.toHaveBeenCalled();
});

it('rejects legacy extension options instead of silently ignoring their policies', () => {
  expect(() =>
    Reflect.apply(lint, undefined, [{ ...options, customRules: [rule('legacy')] }]),
  ).toThrow(/inside the config option/u);
});
