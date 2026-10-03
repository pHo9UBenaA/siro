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
  ConfigError,
  type LintResult,
  type SiroConfig,
  type FileSystem,
  type PM,
  type LintOptions,
  type RequireConfigKeySpec,
  type Rule,
  DEFAULT_SCAN_LIMITS,
  type ScanLimits,
  type IO,
} from '@pho9ubenaa/siro';

// Isolated installed consumer: no internal imports or dev dependency types.
function check(condition: boolean, contract: string): void {
  if (!condition) throw new Error(`Installed public API: ${contract}`);
}
function captureThrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the action to throw.');
}
function captureOutput(): { io: IO; text: () => string } {
  const chunks: string[] = [];
  return {
    io: { stdout: (text) => chunks.push(text), stderr() {} },
    text: () => chunks.join(''),
  };
}
const posix = (value: string) => value.replaceAll('\\', '/');
const emptyFs: FileSystem = {
  readDirectories: () => [],
  exists: () => false,
  readText: () => undefined,
};
const builtinId: Extract<keyof NonNullable<SiroConfig['rules']>, 'files-field'> = 'files-field';
void builtinId;

function verifyLimits() {
  const limits: Partial<ScanLimits> = { maxFileBytes: DEFAULT_SCAN_LIMITS.maxFileBytes };
  check(
    lint({ cwd: asAbsPath('/virtual'), fs: emptyFs, installationRoots: [], limits }).inspection
      .manifests.length === 0,
    'empty discovery accepts the public scan limits',
  );
  const failure = captureThrown(() =>
    lint({
      cwd: asAbsPath('/virtual'),
      fs: { ...emptyFs, readText: () => '{"private":true}' },
      installationRoots: [],
      limits: { maxFileBytes: 1 },
    }),
  );
  check(
    failure instanceof Error && failure.message.includes('maxFileBytes'),
    'file byte overflow propagates through lint',
  );
}

// @ts-expect-error workspace selection is removed, not an alias.
const oldOptions: LintOptions = { cwd: asAbsPath('/virtual'), workspaces: true };
void oldOptions;
// @ts-expect-error recursive discovery requires enumeration; no native fallback.
const incompleteFs: FileSystem = { exists: () => false, readText: () => undefined };
void incompleteFs;
function verifySynchronousApi() {
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
    check(
      result.inspection.installationRoots[0]?.targets[0]?.pm === pm,
      `explicit ${pm} target is preserved`,
    );
    if (pm === 'npm')
      check(
        result.findings.some(
          (finding) => finding.ruleId === 'consumer-probe' && finding.message === 'Target 11.9.0',
        ),
        'custom rule receives the configured npm version',
      );
  }
}

async function verifyReporterCompletion() {
  const { io, text } = captureOutput();
  await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      fs: emptyFs,
      reporter: {
        name: 'async',
        async format(_result, targetIO) {
          await Promise.resolve();
          await targetIO.stdout('reported');
        },
      },
    },
    io,
  );
  check(text() === 'reported', 'lintCommand awaits asynchronous reporter completion');
}

async function verifyReporterFailure() {
  const failure = new Error('reporter failure');
  const { io, text } = captureOutput();
  const caught = await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      fs: emptyFs,
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
  ).then(
    () => undefined,
    (error: unknown) => error,
  );
  check(
    caught === failure && text() === 'partial',
    'reporter failure identity propagates after partial output',
  );
}

function verifyInspection() {
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
  check(
    result.inspection.manifests.length === 3,
    'discovery ignores workspace declaration exclusions',
  );
  check(
    result.inspection.installationRoots.length === 2,
    'only explicit installation roots are selected',
  );
  const generic = result.findings.find(
    (finding) => finding.ruleId === 'files-field' && finding.directory === 'child',
  );
  const maybePm: PM | undefined = generic?.pm;
  check(
    maybePm === undefined && generic?.file === 'child/package.json',
    'generic child finding is PM-neutral and rebased',
  );
  check(
    result.findings.some(
      (finding) =>
        finding.directory === 'child' &&
        finding.remediation?.kind === 'automatic' &&
        finding.remediation.operations.every((operation) =>
          operation.file.path.startsWith('child/'),
        ),
    ),
    'every child remediation operation is rebased',
  );
  check(
    lint({ cwd: asAbsPath('/virtual'), fs, installationRoots: [] }).inspection.installationRoots
      .length === 0,
    'an empty installation root list disables installation inspection',
  );
  return result;
}

async function verifyJsonReport(result: LintResult) {
  const { io, text } = captureOutput();
  await jsonReporter.format(result, io, { cwd: asAbsPath('/virtual') });
  const report = JSON.parse(text());
  check(report.schemaVersion === 3, 'JSON identifies schema version 3');
  check(report.siroVersion === version, 'JSON identifies the installed package version');
  check(
    JSON.stringify(report.inspection) === JSON.stringify(result.inspection),
    'JSON preserves inspection scope',
  );
  check(
    JSON.stringify(report.findings) === JSON.stringify(result.findings),
    'JSON preserves findings',
  );
}

async function verifyJsonEscaping(result: LintResult) {
  const marker = '##[error]literal\u202e';
  const { io, text } = captureOutput();
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
    io,
    { cwd: asAbsPath('/virtual') },
  );
  const encoded = text();
  check(
    !encoded.includes('##[') && !encoded.includes('\u202e'),
    'JSON escapes annotation openers and bidi controls',
  );
  check(
    JSON.parse(encoded).findings[0].message === marker,
    'JSON escaping preserves the decoded message',
  );
}

async function verifyGitHubReport(result: LintResult) {
  const { io, text } = captureOutput();
  await githubReporter.format(result, io, { cwd: asAbsPath('/virtual') });
  check(
    posix(text()).includes('/virtual/child/package.json'),
    'GitHub annotations resolve child paths against cwd',
  );
}

async function verifyOutputFailure() {
  const writeFailure = new Error('delayed write');
  const outputFailure = await lintCommand(
    { cwd: asAbsPath('/virtual'), fs: emptyFs, installationRoots: [], reporter: 'json' },
    {
      async stdout() {
        throw writeFailure;
      },
      stderr() {},
    },
  ).then(
    () => undefined,
    (error: unknown) => error,
  );
  check(outputFailure === writeFailure, 'delayed sink failure identity propagates');
}

function verifyPublicBuilder() {
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
    }).findings.find((finding) => finding.ruleId === helper.id)?.severity === 'info',
    'public builder honors an explicitly unconditional safe default',
  );
}

function verifyPublicBuilderValidation() {
  const options = {
    id: 'company-policy',
    title: 'Company policy',
    description: 'Require approved',
    severity: 'error',
  };
  const spec = {
    file: CONFIG_FILES.npmrc,
    keyPath: ['approved'],
    value: true,
    message: 'Enable approved',
  };
  const bindingFailure = captureThrown(() =>
    Reflect.apply(requireConfigKey, undefined, [{ ...options, bindings: { nmp: spec } }]),
  );
  check(
    bindingFailure instanceof ConfigError && /bindings.*nmp/.test(bindingFailure.message),
    'public builder rejects unknown manager keys instead of dropping policy',
  );
  const rule: Rule = Reflect.apply(requireConfigKey, undefined, [
    { ...options, bindings: { npm: { ...spec, accept: async () => false } } },
  ]);
  const predicateFailure = captureThrown(() =>
    lint({
      cwd: asAbsPath('/virtual'),
      fs: emptyFs,
      pm: 'npm',
      installationRoots: [],
      config: { customRules: [rule] },
    }),
  );
  check(
    predicateFailure instanceof ConfigError && /accept.*synchronous/.test(predicateFailure.message),
    'public builder rejects async acceptance instead of reporting clean findings',
  );
}

async function verifyGroupedResults() {
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
    const { io, text } = captureOutput();
    await lintCommand(
      {
        cwd: asAbsPath('/virtual'),
        pm: 'npm',
        fs: emptyFs,
        config: { customRules: [multi] },
        reporter,
      },
      io,
    );
    const output = text();
    check(
      output.includes('First file') && output.includes('Second file'),
      `${reporter} reports both independent group members`,
    );
  }
}

verifyLimits();
verifySynchronousApi();
await verifyReporterCompletion();
await verifyReporterFailure();
const result = verifyInspection();
await verifyJsonReport(result);
await verifyJsonEscaping(result);
await verifyGitHubReport(result);
await verifyOutputFailure();
verifyPublicBuilder();
verifyPublicBuilderValidation();
await verifyGroupedResults();
