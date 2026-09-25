import type { IO } from '../../core/contracts/io.ts';
import type { LintResult } from '../../core/contracts/lint-result.ts';
import type { Reporter } from '../../core/contracts/reporter.ts';
import type { Severity } from '../../core/contracts/pms.ts';

const COMMAND: Record<Severity, string> = {
  error: 'error',
  info: 'notice',
  warn: 'warning',
};

// https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
const escapeData = (raw: string): string =>
  raw.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

// Properties additionally escape their delimiters; the body does not.
const escapeProp = (raw: string): string =>
  escapeData(raw).replaceAll(':', '%3A').replaceAll(',', '%2C');

/** Emit GitHub Actions workflow commands (annotations on PRs). */
export const githubReporter: Reporter<'github'> = {
  format(result: LintResult, io: IO): void {
    for (const finding of result.findings) {
      // Findings identify files, not source spans.
      let file = '';
      if (finding.file) {
        file = `file=${escapeProp(finding.file)},`;
      }
      // Documentation belongs in the body; the protocol has no URL property.
      let body = `[${finding.pm}] ${finding.message}`;
      if (finding.docs) {
        body += ` (${finding.docs})`;
      }
      io.stdout(
        `::${COMMAND[finding.severity]} ${file}title=${escapeProp(finding.ruleId)}::${escapeData(body)}`,
      );
    }
  },
  name: 'github',
};
