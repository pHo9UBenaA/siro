import { asRelPath } from '../../../src/shared/paths.ts';
import assert from 'node:assert';
import type { IO } from '../../../src/domain/ports/io.ts';
import type { LintResult } from '../../../src/domain/entities/lint-result.ts';
import { SCHEMA_VERSION, jsonReporter } from '../../../src/adapters/reporters/json.ts';
import { version } from '../../../src/version.ts';

vi.setConfig({ testTimeout: 5000 });

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
      fix: [
        {
          file: { kind: 'npmrc', path: asRelPath('.npmrc') },
          keyPath: ['save-exact'],
          op: 'setKey',
          value: true,
        },
      ],
      fixable: true,
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
    expect(render(result)).toHaveProperty('schemaVersion', SCHEMA_VERSION);
  });
  it('stamps the running siro version on the document root', () => {
    expect.hasAssertions();
    expect(render(result)).toHaveProperty('siroVersion', version);
  });
  it('round-trips a finding fix op through JSON', () => {
    expect.hasAssertions();
    const parsed: {
      findings: { fix: { keyPath: string[]; value: unknown }[] }[];
    } = JSON.parse((() => JSON.stringify(render(result)))());
    const FIRST = 0;
    const finding = parsed.findings[FIRST];
    assert(finding, 'expected finding');
    expect(finding.fix[FIRST]).toMatchObject({ keyPath: ['save-exact'], value: true });
  });
});
