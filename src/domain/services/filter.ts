import type { Finding, LintResult } from '../entities/lint-result.ts';
import { SEVERITY_RANK, type Severity } from '../entities/pms.ts';

const EXIT_SUCCESS = 0;
const EXIT_FAILURE = 1;

const meetsThreshold = (severity: Severity, threshold: Severity): boolean =>
  SEVERITY_RANK[severity] >= SEVERITY_RANK[threshold];

/** Keep only findings at or above `threshold`, recomputing the summary. */
export const filterBySeverity = (result: LintResult, threshold: Severity): LintResult => {
  const findings: Finding[] = [];
  const summary: Record<Severity, number> = { error: 0, info: 0, warn: 0 };
  for (const finding of result.findings) {
    if (meetsThreshold(finding.severity, threshold)) {
      findings.push(finding);
      summary[finding.severity] += EXIT_FAILURE;
    }
  }
  return { findings, summary };
};

/**
 * Exit code for a lint run. Non-zero when any finding meets `threshold`
 * (default: only `error` fails the run).
 */
export const exitCodeForLint = (result: LintResult, threshold: Severity = 'error'): number => {
  if (result.findings.some((finding) => meetsThreshold(finding.severity, threshold))) {
    return EXIT_FAILURE;
  }
  return EXIT_SUCCESS;
};
