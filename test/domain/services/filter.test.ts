import { exitCodeForLint, filterBySeverity } from '../../../src/domain/services/filter.ts';
import type { LintResult } from '../../../src/domain/entities/lint-result.ts';

vi.setConfig({ testTimeout: 5000 });

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const result: LintResult = {
  findings: [
    { fix: [], fixable: true, message: 'm', pm: 'npm', ruleId: 'a', severity: 'error' },
    { fix: [], fixable: true, message: 'm', pm: 'npm', ruleId: 'b', severity: 'warn' },
    { fix: [], fixable: false, message: 'm', pm: 'npm', ruleId: 'c', severity: 'info' },
  ],
  summary: { error: 1, info: 1, warn: 1 },
};

describe(filterBySeverity, () => {
  it('keeps only findings at or above the threshold and recomputes the summary', () => {
    expect.hasAssertions();
    const warnOrAbove = filterBySeverity(result, 'warn');
    expect(warnOrAbove.findings.map((finding) => finding.ruleId)).toStrictEqual(['a', 'b']);
    expect(warnOrAbove.summary).toStrictEqual({ error: 1, info: 0, warn: 1 });
  });

  it('keeps only error findings at the error threshold and zeroes the lower buckets', () => {
    expect.hasAssertions();
    // The `'warn'` test above pins the middle case, but a regression in
    // SEVERITY_RANK that confused error and warn ranks (e.g. swapped to
    // SEVERITY_RANK[warn] >= SEVERITY_RANK[error]) would still pass the
    // warn-threshold test because the trio contains exactly one of each
    // severity. Pinning the error case ensures the ordering is checked
    // in both directions.
    const errorsOnly = filterBySeverity(result, 'error');
    expect(errorsOnly.findings.map((finding) => finding.ruleId)).toStrictEqual(['a']);
    expect(errorsOnly.summary).toStrictEqual({ error: 1, info: 0, warn: 0 });
  });

  it('returns every finding at the info threshold and preserves the original summary', () => {
    expect.hasAssertions();
    // Lowest-threshold case: filterBySeverity must be a no-op on the
    // findings list and recompute the summary to the same counts the
    // input already exposes. A regression that dropped infos here would
    // silently shrink the JSON reporter's output for `--severity info`.
    const all = filterBySeverity(result, 'info');
    expect(all.findings.map((finding) => finding.ruleId)).toStrictEqual(['a', 'b', 'c']);
    expect(all.summary).toStrictEqual({ error: 1, info: 1, warn: 1 });
  });
});

describe(exitCodeForLint, () => {
  it('fails with exit code 1 when findings include errors at the default threshold', () => {
    expect.hasAssertions();
    expect(exitCodeForLint(result, 'error')).toBe(EXIT_FAILURE);
  });

  it('exits 0 when there are no findings', () => {
    expect.hasAssertions();
    expect(exitCodeForLint({ findings: [], summary: { error: 0, info: 0, warn: 0 } })).toBe(
      EXIT_SUCCESS,
    );
  });

  it('fails on warnings when the threshold is warn', () => {
    expect.hasAssertions();
    const warnOnly: LintResult = {
      findings: [
        { fix: [], fixable: true, message: 'm', pm: 'npm', ruleId: 'b', severity: 'warn' },
      ],
      summary: { error: 0, info: 0, warn: 1 },
    };
    expect(exitCodeForLint(warnOnly, 'warn')).toBe(EXIT_FAILURE);
    expect(exitCodeForLint(warnOnly, 'error')).toBe(EXIT_SUCCESS);
  });
});
