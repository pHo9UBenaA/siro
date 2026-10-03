import type { IO } from '../../core/contracts/io.ts';
import path from 'node:path';
import type { LintResult } from '../../core/contracts/lint-result.ts';
import type { Reporter, ReportContext } from '../../core/contracts/reporter.ts';
import type { Severity } from '../../core/contracts/pms.ts';
import { DEFAULT_SCAN_LIMITS, outputBudget } from '../../core/contracts/scan-limits.ts';

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
  async format(result: LintResult, io: IO, context: ReportContext): Promise<void> {
    const consume = outputBudget(
      context.limits?.maxOutputBytes ?? DEFAULT_SCAN_LIMITS.maxOutputBytes,
    );
    for (const finding of result.findings) {
      // Findings identify files, not source spans.
      const fileProperty = finding.file
        ? `file=${escapeProp(path.resolve(context.cwd, finding.file))},`
        : '';
      // Documentation belongs in the body; the protocol has no URL property.
      const docsSuffix = finding.docs ? ` (${finding.docs})` : '';
      const body = `[${finding.pm ?? 'package'}] ${finding.directory}: ${finding.message}${docsSuffix}`;
      const line = `::${COMMAND[finding.severity]} ${fileProperty}title=${escapeProp(finding.ruleId)}::${escapeData(body)}`;
      consume(`${line}\n`);
      await io.stdout(line);
    }
  },
  name: 'github',
};
