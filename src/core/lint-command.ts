import { type Severity, isSeverity } from './contracts/pms.ts';
import { type Reporter, type ReportContext, isReporterShape } from './contracts/reporter.ts';
import { exitCodeForLint, filterBySeverity } from './filter.ts';
import type { IO } from './contracts/io.ts';
import { UsageError } from './contracts/errors.ts';
import type { LintDependencies } from './contracts/lint-dependencies.ts';
import { prepareLint, runPreparedLint, type LintOptions } from './lint.ts';
import { outputBudget, type ScanLimits } from './contracts/scan-limits.ts';
import type { LintResult } from './contracts/lint-result.ts';

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
  await reportAndAwaitWrites(reporter, filterBySeverity(result, options.severity ?? 'info'), io, {
    cwd: options.cwd,
    limits: prepared.evaluation.limits,
  });
  return exitCode;
};

const reportAndAwaitWrites = async (
  reporter: Reporter,
  result: LintResult,
  io: IO,
  context: ReportContext & { limits: ScanLimits },
): Promise<void> => {
  // Observe legacy unawaited writes immediately. A reporter throw takes precedence
  // over sink failures, but all started writes must settle before it propagates.
  const pendingWrites: Promise<void>[] = [];
  const consumeOutput = outputBudget(context.limits.maxOutputBytes);
  // The wrapper distinguishes "no failure" from a sink that throws undefined.
  let outputFailure: { error: unknown } | undefined;
  const recordFailure = (error: unknown) => {
    outputFailure ??= { error };
  };
  const trackWrite =
    (write: IO['stdout']): IO['stdout'] =>
    (line) => {
      try {
        consumeOutput(`${line}\n`);
        const written = write(line);
        pendingWrites.push(Promise.resolve(written).then(() => {}, recordFailure));
        return written;
      } catch (error) {
        recordFailure(error);
        throw error;
      }
    };
  try {
    await reporter.format(
      result,
      {
        stdout: trackWrite((line) => io.stdout(line)),
        stderr: trackWrite((line) => io.stderr(line)),
      },
      context,
    );
  } finally {
    await Promise.all(pendingWrites);
  }
  if (outputFailure) throw outputFailure.error;
};
