import {
  asAbsPath,
  defineConfig,
  defineRule,
  jsonReporter,
  lint,
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
  customRules: [
    defineRule({
      id: 'consumer-probe',
      title: 'Consumer probe',
      description: 'Verify an installed custom rule',
      severity: 'warn',
      bindings: {
        npm: {
          check: () => ({
            state: 'violation',
            message: 'Installed rule works',
            remediation: { kind: 'manual', steps: ['Review the finding'] },
          }),
        },
      },
    }),
  ],
});

check(PMS.length === 6);
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
