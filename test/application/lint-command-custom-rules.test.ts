import { asAbsPath, CONFIG_FILES, type FileSystem, type LintOptions } from '../../src/index.ts';
import { lint, lintCommand } from '../../src/composition/lint.ts';
import type { LintResult } from '../../src/domain/entities/lint-result.ts';
import type { CheckStatus, Rule } from '../../src/domain/entities/rule.ts';
import type { SiroConfig } from '../../src/domain/entities/siro-config.ts';
import { ConfigError, UsageError } from '../../src/shared/errors.ts';
import { asRelPath } from '../../src/shared/paths.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';

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

it.each(['package.json', './package.json'])(
  'gives manifest metadata and rule config the same package.json source via %s',
  (rulePath) => {
    let reads = 0;
    const fs: FileSystem = {
      exists: () => false,
      readText: (file) => {
        if (file !== '/repo/package.json') return undefined;
        reads++;
        return JSON.stringify({ private: reads > 1 });
      },
    };
    const seen: unknown[] = [];
    const snapshotOptions: LintOptions = {
      cwd: asAbsPath('/repo'),
      pm: 'npm' as const,
      fs,
      config: {
        customRules: [
          {
            ...rule('package-snapshot'),
            bindings: {
              npm: {
                file: { ...CONFIG_FILES.packageJson, path: asRelPath(rulePath) },
                check: (ctx, config) => {
                  seen.push([ctx.packageJson?.private, config.private]);
                  return { state: 'ok' };
                },
              },
            },
          },
        ],
      },
    };
    lint(snapshotOptions);
    expect(seen).toEqual([[false, false]]);
    expect(reads).toBe(1);
    lint(snapshotOptions);
    expect(seen).toEqual([
      [false, false],
      [true, true],
    ]);
    expect(reads).toBe(2);
  },
);

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

it.each([{ customRules: [rule('provenance')] }] satisfies SiroConfig[])(
  'rejects ambiguous or unknown rule IDs: %j',
  (config) => {
    expect(() => lint({ ...options, config })).toThrow(ConfigError);
  },
);

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
  expect(() => lint({ ...options, config: config as unknown as SiroConfig })).toThrow(ConfigError);
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
    lint({ ...options, config: { customRules: [rule('invalid', () => status as CheckStatus)] } }),
  ).toThrow("Rule 'invalid' returned an invalid check result.");
});

it.each(['unknown', { name: 'broken' }])(
  'rejects an invalid reporter selection: %j',
  async (reporter) => {
    await expect(
      lintCommand({ ...options, reporter: reporter as never }, captureIO().io),
    ).rejects.toThrow(UsageError);
  },
);

it('waits for asynchronous reporting before returning the lint exit code', async () => {
  const { io, out } = captureIO();
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let settled = false;
  const command = lintCommand(
    {
      ...options,
      reporter: 'async',
      config: {
        customRules: [rule('custom')],
        reporters: [
          {
            name: 'async',
            async format(result, targetIO) {
              expect(result.findings).toContainEqual(expect.objectContaining({ ruleId: 'custom' }));
              expect(targetIO).toBe(io);
              await ready;
              targetIO.stdout('reported');
            },
          },
        ],
      },
    },
    io,
  ).then((code) => {
    settled = true;
    return code;
  });
  try {
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(out()).toBe('');
  } finally {
    release();
    await command;
  }
  expect(await command).toBe(1);
  expect(out()).toContain('reported');
});

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
