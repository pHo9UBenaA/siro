import {
  asAbsPath,
  asRelPath,
  defineConfig,
  defineRule,
  jsonReporter,
  githubReporter,
  lint,
  lintCommand,
  PMS,
  PROJECT_TYPES,
  version,
  requireConfigKey,
  CONFIG_FILES,
  type LintResult,
  type SiroConfig,
  type FileSystem,
  type PM,
  type LintOptions,
  type RequireConfigKeySpec,
  DEFAULT_SCAN_LIMITS,
  type ScanLimits,
} from '@pho9ubenaa/siro';

// Isolated installed consumer: no internal imports or dev dependency types.
function check(condition: boolean): void {
  if (!condition) throw new Error('Installed public API verification failed');
}
const posix = (value: string) => value.replaceAll('\\', '/');
const emptyFs: FileSystem = {
  readDirectories: () => [],
  exists: () => false,
  readText: () => undefined,
};
const builtinId: Extract<keyof NonNullable<SiroConfig['rules']>, 'files-field'> = 'files-field';
check(builtinId === 'files-field');
const limits: Partial<ScanLimits> = { maxFileBytes: DEFAULT_SCAN_LIMITS.maxFileBytes };
check(
  lint({ cwd: asAbsPath('/virtual'), fs: emptyFs, installationRoots: [], limits }).inspection
    .manifests.length === 0,
);
let overflow = false;
try {
  lint({
    cwd: asAbsPath('/virtual'),
    fs: { ...emptyFs, readText: () => '{"private":true}' },
    installationRoots: [],
    limits: { maxFileBytes: 1 },
  });
} catch (error) {
  overflow = error instanceof Error && error.message.includes('maxFileBytes');
}
check(overflow);
// @ts-expect-error workspace selection is removed, not an alias.
const oldOptions: LintOptions = { cwd: asAbsPath('/virtual'), workspaces: true };
void oldOptions;
// @ts-expect-error recursive discovery requires enumeration; no native fallback.
const incompleteFs: FileSystem = { exists: () => false, readText: () => undefined };
void incompleteFs;
const config = defineConfig({
  pmVersions: { npm: '11.9.0' },
  customRules: [
    defineRule({
      id: 'consumer-probe',
      title: 'Probe',
      description: 'Installed rule',
      severity: 'warn',
      bindings: {
        npm: {
          check: (ctx) => ({
            state: 'violation',
            message: `Target ${ctx.pmVersion}`,
            remediation: { kind: 'manual', steps: ['Review'] },
          }),
        },
      },
    }),
  ],
});
for (const projectType of PROJECT_TYPES)
  lint({ cwd: asAbsPath('/virtual'), pm: 'npm', projectType, fs: emptyFs });
for (const pm of PMS) {
  const result = lint({ cwd: asAbsPath('/virtual'), pm, fs: emptyFs, config });
  // @ts-expect-error lint remains synchronous.
  const asyncResult: Promise<LintResult> = result;
  void asyncResult;
  check(result.inspection.installationRoots[0]?.targets[0]?.pm === pm);
  if (pm === 'npm')
    check(
      result.findings.some((f) => f.ruleId === 'consumer-probe' && f.message === 'Target 11.9.0'),
    );
}
let reported = false;
await lintCommand(
  {
    cwd: asAbsPath('/virtual'),
    pm: 'npm',
    fs: emptyFs,
    reporter: {
      name: 'async',
      async format() {
        await Promise.resolve();
        reported = true;
      },
    },
  },
  { stdout() {}, stderr() {} },
);
check(reported);
const failure = new Error('reporter failure');
let caught: unknown;
let partial = '';
try {
  await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      fs: emptyFs,
      reporter: {
        name: 'partial',
        async format(_result, io) {
          io.stdout('partial');
          await Promise.resolve();
          throw failure;
        },
      },
    },
    {
      stdout(text) {
        partial += text;
      },
      stderr() {},
    },
  );
} catch (error) {
  caught = error;
}
check(caught === failure && partial === 'partial');

const files: Record<string, string> = {
  '/virtual/package.json':
    '{"private":true,"packageManager":"pnpm@11.7.0","workspaces":["!child"]}',
  '/virtual/child/package.json': '{"name":"child","packageManager":"npm@12.0.2"}',
  '/virtual/other/deno.json': '{"name":"@test/other"}',
};
const fs: FileSystem = {
  readDirectories: (directory) => (posix(directory) === '/virtual' ? ['child', 'other'] : []),
  readText: (file) => files[posix(file)],
  exists: (file) => Object.hasOwn(files, posix(file)),
};
const result = lint({
  cwd: asAbsPath('/virtual'),
  fs,
  config: defineConfig({
    installationRoots: ['.', { path: 'child', pm: 'npm', pmVersion: '12.0.2' }],
    exclude: [],
  }),
});
check(result.inspection.manifests.length === 3);
check(result.inspection.installationRoots.length === 2);
const generic = result.findings.find((f) => f.ruleId === 'files-field' && f.directory === 'child');
const maybePm: PM | undefined = generic?.pm;
check(maybePm === undefined && generic?.file === 'child/package.json');
check(
  result.findings.some(
    (f) =>
      f.directory === 'child' &&
      f.remediation?.kind === 'automatic' &&
      f.remediation.operations.every((op) => op.file.path.startsWith('child/')),
  ),
);
let output = '';
await jsonReporter.format(
  result,
  {
    stdout(text) {
      output += text;
    },
    stderr() {},
  },
  { cwd: asAbsPath('/virtual') },
);
const report = JSON.parse(output);
check(report.schemaVersion === 3 && report.siroVersion === version);
check(JSON.stringify(report.inspection) === JSON.stringify(result.inspection));
check(JSON.stringify(report.findings) === JSON.stringify(result.findings));
const marker = '##[error]literal\u202e';
let encoded = '';
await jsonReporter.format(
  {
    ...result,
    findings: [
      {
        ruleId: 'probe',
        directory: '.',
        message: marker,
        severity: 'info',
      },
    ],
  },
  {
    stdout: (text) => {
      encoded += text;
    },
    stderr() {},
  },
  { cwd: asAbsPath('/virtual') },
);
check(!encoded.includes('##[') && !encoded.includes('\u202e'));
check(JSON.parse(encoded).findings[0].message === marker);
let annotations = '';
await githubReporter.format(
  result,
  {
    stdout: (text) => {
      annotations += text;
    },
    stderr() {},
  },
  { cwd: asAbsPath('/virtual') },
);
check(posix(annotations).includes('/virtual/child/package.json'));
const writeFailure = new Error('delayed write');
let outputFailure: unknown;
try {
  await lintCommand(
    { cwd: asAbsPath('/virtual'), fs: emptyFs, installationRoots: [], reporter: 'json' },
    {
      async stdout() {
        throw writeFailure;
      },
      stderr() {},
    },
  );
} catch (error) {
  outputFailure = error;
}
check(outputFailure === writeFailure);
check(
  lint({ cwd: asAbsPath('/virtual'), fs, installationRoots: [] }).inspection.installationRoots
    .length === 0,
);

const defaultSafety: RequireConfigKeySpec['defaultSafety'] = 'unconditional';
const helper = requireConfigKey({
  id: 'safe-default',
  title: 'Default',
  description: 'Explicit policy',
  severity: 'error',
  bindings: {
    npm: {
      file: CONFIG_FILES.npmrc,
      keyPath: ['safe'],
      value: true,
      message: 'Pin safe',
      documentedDefault: true,
      defaultSafety,
      versionNote: { defaultSafeSince: 'display only' },
    },
  },
});
check(
  lint({
    cwd: asAbsPath('/virtual'),
    fs: emptyFs,
    pm: 'npm',
    config: { customRules: [helper] },
  }).findings.find((f) => f.ruleId === helper.id)?.severity === 'info',
);

const multi = defineRule({
  id: 'multiple',
  title: 'Multiple',
  description: 'Independent files',
  severity: 'warn',
  bindings: {
    npm: {
      check: () => ({
        state: 'violations',
        violations: [
          { state: 'violation', message: 'First file', file: asRelPath('.npmrc') },
          { state: 'violation', message: 'Second file', file: asRelPath('package.json') },
        ],
      }),
    },
  },
});
for (const reporter of ['json', 'pretty', 'github'] as const) {
  let text = '';
  await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      fs: emptyFs,
      config: { customRules: [multi] },
      reporter,
    },
    {
      stdout(line) {
        text += line;
      },
      stderr() {},
    },
  );
  check(text.includes('First file') && text.includes('Second file'));
}
