import {
  asAbsPath,
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
      exists: (file) => file.endsWith('/.npmrc'),
      readText: (file) => (file.endsWith('/.npmrc') ? 'min-release-age=3' : undefined),
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
    exists: (file) => Object.hasOwn(workspaceFiles, file),
    readText: (file) => workspaceFiles[file],
    readDirectories: (directory) => (directory === '/virtual' ? ['child'] : []),
  },
});
check(
  workspaceResult.findings.some(
    (finding) => finding.ruleId === 'files-field' && finding.file === 'child/package.json',
  ),
);
