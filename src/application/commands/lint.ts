import { type Severity, isSeverity } from '../../domain/entities/pms.ts';
import { type Reporter, isReporterShape } from '../../domain/ports/reporter.ts';
import { exitCodeForLint, filterBySeverity } from '../../domain/services/filter.ts';
import type { IO } from '../../domain/ports/io.ts';
import { UsageError } from '../../shared/errors.ts';
import type { LintDependencies } from '../ports/lint-dependencies.ts';
import { prepareLint, runPreparedLint, type LintOptions } from '../lint.ts';

export interface LintCommandOptions extends LintOptions {
  readonly reporter?: string | Reporter;
  readonly severity?: Severity;
}

/** Evaluate and report. Executable config loading belongs to the CLI adapter. */
export const lintCommand = async (
  options: LintCommandOptions,
  io: IO,
  dependencies: LintDependencies,
  reporters: {
    readonly defaultName: string;
    readonly createRegistry: (extras: readonly Reporter[]) => ReadonlyMap<string, Reporter>;
  },
): Promise<number> => {
  if (!options) throw new UsageError('Lint options are required.');
  if (options.severity !== undefined && !isSeverity(options.severity)) {
    throw new UsageError(`Invalid severity: ${String(options.severity)}`);
  }
  const prepared = prepareLint(options, dependencies);
  const registry = reporters.createRegistry(prepared.reporters);
  const selection = options.reporter ?? reporters.defaultName;
  const reporter = typeof selection === 'string' ? registry.get(selection) : selection;
  if (!isReporterShape(reporter)) {
    throw new UsageError(
      `${typeof selection === 'string' ? 'Unknown' : 'Invalid'} reporter: ${String(selection)} (available: ${[...registry.keys()].join(', ')})`,
    );
  }
  const result = runPreparedLint(prepared);
  const exitCode = exitCodeForLint(result, options.severity ?? 'error');
  await reporter.format(filterBySeverity(result, options.severity ?? 'info'), io);
  return exitCode;
};
