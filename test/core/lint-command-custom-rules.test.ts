import path from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  asAbsPath,
  asRelPath,
  CONFIG_FILES,
  ConfigError,
  UsageError,
  lint,
  lintCommand,
  type FileSystem,
  type LintOptions,
  type LintResult,
  type CheckStatus,
  type ConfigFileRef,
  type RuleBinding,
  type Rule,
  type Reporter,
  type SiroConfig,
} from '../../src/index.ts';
import { npmGoodFs } from '../helpers/fixtures.ts';
import { captureIO } from '../helpers/io.ts';

const rule = (
  id: string,
  check: RuleBinding['check'] = () => ({ state: 'violation', message: 'custom violation' }),
  file: ConfigFileRef = CONFIG_FILES.npmrc,
): Rule => ({
  id,
  title: id,
  description: id,
  severity: 'error',
  bindings: { npm: { file, check } },
});
const options = { cwd: asAbsPath('/repo'), fs: npmGoodFs() };

it.each(['package.json', './package.json'])(
  'gives manifest metadata and rule config the same package.json source via %s',
  (rulePath) => {
    let reads = 0;
    let extraReads = 0;
    const manifest = path.join('/repo', 'package.json');
    const fs: FileSystem = {
      readDirectories: () => [],
      exists: () => false,
      readText: (file) => {
        if (file === path.join('/repo', 'extra.txt')) return String(++extraReads);
        if (file !== manifest) return undefined;
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
          rule(
            'package-snapshot',
            (ctx, config) => {
              seen.push([
                ctx.packageJson?.private,
                config.private,
                ctx.readText(asRelPath('extra.txt')),
                ctx.readText(asRelPath('./extra.txt')),
              ]);
              return { state: 'ok' };
            },
            { ...CONFIG_FILES.packageJson, path: asRelPath(rulePath) },
          ),
        ],
      },
    };
    lint(snapshotOptions);
    expect(seen).toEqual([[false, false, '1', '1']]);
    expect(reads).toBe(1);
    expect(extraReads).toBe(1);
    lint(snapshotOptions);
    expect(seen).toEqual([
      [false, false, '1', '1'],
      [true, true, '2', '2'],
    ]);
    expect(reads).toBe(2);
    expect(extraReads).toBe(2);
  },
);

it('keeps an absent manifest absent within a scan and re-reads it on the next scan', () => {
  const manifest = path.join('/repo', 'package.json');
  let reads = 0;
  const seen: unknown[] = [];
  const request: LintOptions = {
    cwd: asAbsPath('/repo'),
    pm: 'npm',
    installationRoots: [],
    fs: {
      readDirectories: () => [],
      exists: () => false,
      readText: (file) => (file === manifest && ++reads > 1 ? '{"private":true}' : undefined),
    },
    config: {
      customRules: [
        rule(
          'absent-manifest',
          (ctx, config) => {
            seen.push([ctx.packageJson?.private, config.private]);
            return { state: 'ok' };
          },
          CONFIG_FILES.packageJson,
        ),
      ],
    },
  };
  lint(request);
  expect(seen).toEqual([[undefined, undefined]]);
  expect(reads).toBe(1);
  lint(request);
  expect(seen).toEqual([
    [undefined, undefined],
    [true, true],
  ]);
  expect(reads).toBe(2);
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

it('propagates reporter rejection even after partial output', async () => {
  const failure = new Error('Output failed');
  const { io, out } = captureIO();
  await expect(
    lintCommand(
      {
        ...options,
        reporter: {
          name: 'partial',
          async format(_result, targetIO) {
            targetIO.stdout('partial');
            await Promise.resolve();
            throw failure;
          },
        },
      },
      io,
    ),
  ).rejects.toBe(failure);
  expect(out()).toContain('partial');
});

it('propagates a reporter IO failure without reclassifying it', async () => {
  const failure = new Error('Broken output stream');
  await expect(
    lintCommand(
      { ...options, reporter: 'json' },
      {
        stdout() {
          throw failure;
        },
        stderr() {},
      },
    ),
  ).rejects.toBe(failure);
});

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
              await ready;
              await targetIO.stdout('reported');
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
      fs: { readDirectories: () => [], exists: () => false, readText: () => undefined },
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
