import { asRelPath } from '../../../src/shared/paths.ts';
import type { IO } from '../../../src/domain/ports/io.ts';
import type { LintResult } from '../../../src/domain/entities/lint-result.ts';
import { jsonReporter } from '../../../src/adapters/reporters/json.ts';
import { version } from '../../../src/version.ts';

const render = (result: LintResult): unknown => {
  const lines: string[] = [];
  const io: IO = {
    stderr: (): undefined => void 0,
    stdout: (line) => lines.push(line),
  };
  jsonReporter.format(result, io);
  return JSON.parse(lines.join('\n'));
};

const result: LintResult = {
  findings: [
    {
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
  ],
  summary: { error: 1, info: 0, warn: 0 },
};

describe('json reporter contract', () => {
  it('stamps the schema version on the document root', () => {
    expect.hasAssertions();
    expect(render(result)).toHaveProperty('schemaVersion', 2);
  });
  it('stamps the running siro version on the document root', () => {
    expect.hasAssertions();
    expect(render(result)).toHaveProperty('siroVersion', version);
  });
  it('round-trips automatic remediation through JSON', () => {
    expect.hasAssertions();
    expect(render(result)).toMatchObject({
      findings: [
        {
          remediation: {
            kind: 'automatic',
            operations: [{ keyPath: ['save-exact'], value: true }],
          },
        },
      ],
    });
  });
});
