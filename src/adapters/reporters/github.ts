import type { IO } from '../../domain/ports/io.ts';
import type { LintResult } from '../../domain/entities/lint-result.ts';
import type { Reporter } from '../../domain/ports/reporter.ts';
import type { Severity } from '../../domain/entities/pms.ts';

const COMMAND: Record<Severity, string> = {
  error: 'error',
  info: 'notice',
  warn: 'warning',
};

// GitHub Actions workflow commands require percent-escaping. Property
// values (file=, title=) must additionally escape `:` and `,` because
// they delimit the property list. The message body only needs control
// chars escaped.
// Spec: https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
const escapeProp = (raw: string): string =>
  raw
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A')
    .replaceAll(':', '%3A')
    .replaceAll(',', '%2C');

const escapeData = (raw: string): string =>
  raw.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');

/** Emit GitHub Actions workflow commands (annotations on PRs). */
export const githubReporter: Reporter<'github'> = {
  format(result: LintResult, io: IO): void {
    for (const finding of result.findings) {
      // No `line=`/`col=` props: a Finding carries no source position (siro
      // flags config-key state, not a span). When Findings grow location info,
      // add `line`/`col` here so the annotation lands on the exact line.
      let file = '';
      if (finding.file) {
        file = `file=${escapeProp(finding.file)},`;
      }
      // The workflow-command syntax has no native "url" prop, so the docs
      // breadcrumb (mirroring `prettyReporter`'s `→ <docs>` line) is appended
      // to the body. `escapeData` re-escapes any `%` in the URL — GitHub's
      // parser then decodes it back, so the user sees the original URL.
      let body = `[${finding.pm}] ${finding.message}`;
      if (finding.docs) {
        body = `[${finding.pm}] ${finding.message} (${finding.docs})`;
      }
      io.stdout(
        `::${COMMAND[finding.severity]} ${file}title=${escapeProp(finding.ruleId)}::${escapeData(body)}`,
      );
    }
  },
  name: 'github',
};
