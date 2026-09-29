import { type Severity, isSeverity } from './contracts/pms.ts';
import { type Reporter, isReporterShape } from './contracts/reporter.ts';
import { exitCodeForLint, filterBySeverity } from './filter.ts';
import type { IO } from './contracts/io.ts';
import { UsageError } from './contracts/errors.ts';
import type { LintDependencies } from './contracts/lint-dependencies.ts';
import { prepareLint, runPreparedLint, type LintOptions } from './lint.ts';

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
  const result = runPreparedLint(prepared.evaluation);
  const exitCode = exitCodeForLint(result, options.severity ?? 'error');
  // Observe every returned write promise immediately, including writes made by
  // legacy synchronous reporters that do not await their sink. Preserve the
  // original failure and await completion even after a reporter throws.
  const writes: Promise<void>[] = [];
  let outputFailed = false;
  let outputFailure: unknown;
  const recordFailure = (error: unknown) => {
    if (!outputFailed) {
      outputFailed = true;
      outputFailure = error;
    }
  };
  const track =
    (write: IO['stdout']): IO['stdout'] =>
    (line) => {
      try {
        const written = write(line);
        writes.push(Promise.resolve(written).then(() => {}, recordFailure));
        return written;
      } catch (error) {
        recordFailure(error);
        throw error;
      }
    };
  try {
    await reporter.format(
      filterBySeverity(result, options.severity ?? 'info'),
      {
        stdout: track((line) => io.stdout(line)),
        stderr: track((line) => io.stderr(line)),
      },
      { cwd: options.cwd },
    );
  } finally {
    await Promise.all(writes);
  }
  if (outputFailed) throw outputFailure;
  return exitCode;
};
