import { type Severity, isSeverity } from '../../domain/entities/pms.ts';
import { type Reporter, isReporterShape } from '../../domain/ports/reporter.ts';
import { exitCodeForLint, filterBySeverity } from '../../domain/services/filter.ts';
import type { IO } from '../../domain/ports/io.ts';
import { UsageError } from '../../shared/errors.ts';
import { DEFAULT_REPORTER_NAME, createRegistry } from '../../adapters/reporters/registry.ts';
import { prepareLint, type LintOptions } from '../lint.ts';
import { runLint } from '../run-lint.ts';

export interface LintCommandOptions extends LintOptions {
  readonly reporter?: string | Reporter;
  readonly severity?: Severity;
}

/** Evaluate and report. Executable config loading belongs to the CLI adapter. */
export const lintCommand = async (options: LintCommandOptions, io: IO): Promise<number> => {
  if (options.severity !== undefined && !isSeverity(options.severity)) {
    throw new UsageError(`Invalid severity: ${String(options.severity)}`);
  }
  const prepared = prepareLint(options);
  const registry = createRegistry(prepared.reporters);
  const selection = options.reporter ?? DEFAULT_REPORTER_NAME;
  const reporter = typeof selection === 'string' ? registry.get(selection) : selection;
  if (!isReporterShape(reporter)) {
    throw new UsageError(
      `${typeof selection === 'string' ? 'Unknown' : 'Invalid'} reporter: ${String(selection)} (available: ${registry.list().join(', ')})`,
    );
  }
  const result = runLint(prepared);
  reporter.format(filterBySeverity(result, options.severity ?? 'info'), io);
  return exitCodeForLint(result, options.severity ?? 'error');
};
