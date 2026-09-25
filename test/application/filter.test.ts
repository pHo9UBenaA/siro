import type { LintResult } from '../../src/core/contracts/lint-result.ts';
import { exitCodeForLint, filterBySeverity } from '../../src/application/commands/filter.ts';

const result: LintResult = {
  findings: [
    { message: 'm', pm: 'npm', ruleId: 'a', severity: 'error' },
    { message: 'm', pm: 'npm', ruleId: 'b', severity: 'warn' },
    { message: 'm', pm: 'npm', ruleId: 'c', severity: 'info' },
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
});

it.each([
  { findings: result.findings, summary: result.summary, threshold: 'error', exit: 1 },
  { findings: [], summary: { error: 0, warn: 0, info: 0 }, threshold: undefined, exit: 0 },
  {
    findings: [result.findings[1]!],
    summary: { error: 0, warn: 1, info: 0 },
    threshold: 'warn',
    exit: 1,
  },
  {
    findings: [result.findings[1]!],
    summary: { error: 0, warn: 1, info: 0 },
    threshold: 'error',
    exit: 0,
  },
] as const)(
  'returns $exit for $summary at $threshold',
  ({ findings, summary, threshold, exit }) => {
    expect(exitCodeForLint({ findings, summary }, threshold)).toBe(exit);
  },
);
