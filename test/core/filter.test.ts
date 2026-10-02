import type { LintResult } from '../../src/core/contracts/lint-result.ts';
import { exitCodeForLint, filterBySeverity } from '../../src/core/filter.ts';

const result: LintResult = {
  inspection: {
    manifests: [{ path: 'child/package.json', projectType: 'package', targets: [] }],
    installationRoots: [],
  },
  findings: [
    { directory: '.', message: 'm', pm: 'npm', ruleId: 'a', severity: 'error' },
    { directory: '.', message: 'm', pm: 'npm', ruleId: 'b', severity: 'warn' },
    { directory: 'child', message: 'm', ruleId: 'c', severity: 'info' },
  ],
  summary: { error: 1, info: 1, warn: 1 },
};

it.each([
  { threshold: 'error', ids: ['a'], summary: { error: 1, warn: 0, info: 0 } },
  { threshold: 'warn', ids: ['a', 'b'], summary: { error: 1, warn: 1, info: 0 } },
  { threshold: 'info', ids: ['a', 'b', 'c'], summary: { error: 1, warn: 1, info: 1 } },
] as const)('filters at $threshold and recomputes its summary', ({ threshold, ids, summary }) => {
  const filtered = filterBySeverity(result, threshold);
  expect(filtered.findings.map((finding) => finding.ruleId)).toEqual(ids);
  expect(filtered.summary).toEqual(summary);
  expect(filtered.inspection).toEqual(result.inspection);
});

it.each([
  { findings: result.findings, threshold: 'error', exit: 1 },
  { findings: [], threshold: undefined, exit: 0 },
  {
    findings: [result.findings[1]!],
    threshold: 'warn',
    exit: 1,
  },
  {
    findings: [result.findings[1]!],
    threshold: 'error',
    exit: 0,
  },
] as const)('returns $exit at threshold $threshold', ({ findings, threshold, exit }) => {
  expect(exitCodeForLint({ findings }, threshold)).toBe(exit);
});
