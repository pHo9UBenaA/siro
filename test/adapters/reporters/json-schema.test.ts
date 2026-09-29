import { asRelPath } from '../../../src/core/contracts/paths.ts';
import type { IO } from '../../../src/core/contracts/io.ts';
import type { LintResult } from '../../../src/core/contracts/lint-result.ts';
import { jsonReporter } from '../../../src/adapters/reporters/json.ts';
import { version } from '../../../src/version.ts';
import { asAbsPath } from '../../../src/index.ts';

const render = async (result: LintResult): Promise<unknown> => {
  const lines: string[] = [];
  const io: IO = {
    stderr: (): undefined => void 0,
    stdout: (line) => lines.push(line),
  };
  await jsonReporter.format(result, io, { cwd: asAbsPath(process.cwd()) });
  return JSON.parse(lines.join('\n'));
};

const result: LintResult = {
  inspection: { manifests: [], installationRoots: [] },
  findings: [
    {
      directory: '.',
      actual: void 0,
      expected: true,
      file: '.npmrc',
      remediation: {
        kind: 'automatic',
        operations: [
          {
            file: { kind: 'npmrc', path: asRelPath('.npmrc') },
            keyPath: ['save-exact'],
            op: 'setKey',
            value: true,
          },
        ],
      },

      message: 'Set `save-exact=true` in .npmrc.',
      pm: 'npm',
      ruleId: 'pin-exact-versions',
      severity: 'error',
    },
    { directory: '.', message: 'warn', pm: 'npm', ruleId: 'warn-rule', severity: 'warn' },
    { directory: '.', message: 'info', ruleId: 'info-rule', severity: 'info' },
  ],
  summary: { error: 1, info: 1, warn: 1 },
};

describe('json reporter contract', () => {
  it('renders one parseable document with versions, summary, and remediation', async () => {
    expect.hasAssertions();
    expect(await render(result)).toMatchObject({
      schemaVersion: 3,
      inspection: { manifests: [], installationRoots: [] },
      siroVersion: version,
      summary: { error: 1, info: 1, warn: 1 },
      findings: [
        {
          remediation: {
            kind: 'automatic',
            operations: [{ keyPath: ['save-exact'], value: true }],
          },
        },
        { severity: 'warn' },
        { severity: 'info' },
      ],
    });
  });
});
