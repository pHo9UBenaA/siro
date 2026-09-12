import {
  asAbsPath,
  asRelPath,
  defineConfig,
  defineRule,
  jsonReporter,
  lint,
  lintCommand,
  PMS,
  version,
  type LintResult,
  type SiroConfig,
} from '@pho9ubenaa/siro';

// This file is copied to an isolated consumer before typechecking and execution.
// Avoid repository imports and dev dependency types: only the installed package
// and TypeScript's standard libraries should be needed.
function check(condition: boolean): void {
  if (!condition) throw new Error('Installed public API verification failed');
}

const posix = (value: string) => value.replaceAll('\\', '/');

const config: SiroConfig = defineConfig({
  pmVersions: { npm: '11.9.0' },
  customRules: [
    defineRule({
      id: 'consumer-probe',
      title: 'Consumer probe',
      description: 'Verify an installed custom rule',
      severity: 'warn',
      bindings: {
        npm: {
          check: (ctx) => ({
            state: 'violation',
            message: `Installed rule targets ${ctx.pmVersion}`,
            remediation: { kind: 'manual', steps: ['Review the finding'] },
          }),
        },
      },
    }),
  ],
});

check(PMS.length === 6);
let reported = false;
await lintCommand(
  {
    cwd: asAbsPath('/virtual'),
    pm: 'npm',
    fs: { exists: () => false, readText: () => undefined },
    reporter: {
      name: 'async-consumer',
      async format() {
        await Promise.resolve();
        reported = true;
      },
    },
  },
  { stdout() {}, stderr() {} },
);
check(reported);
for (const pm of PMS) {
  const result: LintResult = lint({
    cwd: asAbsPath('/virtual'),
    pm,
    fs: { exists: () => false, readText: () => undefined },
    config,
  });
  check(Array.isArray(result.findings));
  if (pm === 'npm') {
    const finding = result.findings.find((item) => item.ruleId === 'consumer-probe');
    check(finding?.severity === 'warn');
    check(finding?.message === 'Installed rule targets 11.9.0');
    check(finding?.remediation?.kind === 'manual');
  }
  let output = '';
  jsonReporter.format(result, {
    stdout: (text) => {
      output += text;
    },
    stderr: () => {},
  });
  const report = JSON.parse(output);
  check(report.schemaVersion === 2 && report.siroVersion === version);
  check(JSON.stringify(report.findings) === JSON.stringify(result.findings));
}

for (const pmVersion of ['11.9.0', '11.10.0']) {
  const result = lint({
    cwd: asAbsPath('/virtual'),
    pm: 'npm',
    pmVersion,
    config,
    fs: {
      exists: (file) => posix(file).endsWith('/.npmrc'),
      readText: (file) => (posix(file).endsWith('/.npmrc') ? 'min-release-age=3' : undefined),
    },
  });
  check(
    result.findings.some((finding) => finding.ruleId === 'unsupported-settings') ===
      (pmVersion === '11.9.0'),
  );
}

const workspaceFiles: Record<string, string> = {
  '/virtual/package.json': JSON.stringify({
    private: true,
    packageManager: 'npm@11.10.0',
    workspaces: ['child'],
  }),
  '/virtual/child/package.json': '{"name":"child"}',
};
const workspaceResult = lint({
  cwd: asAbsPath('/virtual'),
  workspaces: true,
  fs: {
    exists: (file) => Object.hasOwn(workspaceFiles, posix(file)),
    readText: (file) => workspaceFiles[posix(file)],
    readDirectories: (directory) => (posix(directory) === '/virtual' ? ['child'] : []),
  },
});
check(
  workspaceResult.findings.some(
    (finding) => finding.ruleId === 'files-field' && finding.file === 'child/package.json',
  ),
);

for (const pm of ['deno', 'aube'] as const) {
  const files: Record<string, string> =
    pm === 'deno'
      ? {
          '/virtual/deno.json': '{"workspace":["child"]}',
          '/virtual/child/deno.json': '{"name":"@example/child","exports":"./mod.ts"}',
        }
      : {
          '/virtual/aube-workspace.yaml': 'packages: ["child"]',
          '/virtual/child/package.json': '{"name":"child"}',
        };
  const result = lint({
    cwd: asAbsPath('/virtual'),
    pm,
    workspaces: true,
    fs: {
      exists: (file) => Object.hasOwn(files, posix(file)),
      readText: (file) => files[posix(file)],
      readDirectories: (directory) => (posix(directory) === '/virtual' ? ['child'] : []),
    },
  });
  check(
    result.findings.some(
      (finding) =>
        finding.ruleId === 'files-field' &&
        finding.file === `child/${pm === 'deno' ? 'deno.json' : 'package.json'}`,
    ),
  );
}
const oldTarget = lint({
  cwd: asAbsPath('/virtual'),
  pm: 'npm',
  pmVersion: '11.9.0',
  fs: { exists: () => false, readText: () => undefined },
});
check(
  oldTarget.findings.find((finding) => finding.ruleId === 'minimum-release-age')?.remediation
    ?.kind === 'manual',
);

const multiConfig = defineConfig({
  customRules: [
    defineRule({
      id: 'consumer-multiple',
      title: 'Multiple',
      description: 'Independent file results',
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
    }),
  ],
});
for (const reporter of ['json', 'pretty', 'github'] as const) {
  let output = '';
  await lintCommand(
    {
      cwd: asAbsPath('/virtual'),
      pm: 'npm',
      config: multiConfig,
      fs: { exists: () => false, readText: () => undefined },
      reporter,
    },
    {
      stdout(text) {
        output += text;
      },
      stderr() {},
    },
  );
  check(output.includes('First file') && output.includes('Second file'));
  check(output.includes('.npmrc') && output.includes('package.json'));
}
