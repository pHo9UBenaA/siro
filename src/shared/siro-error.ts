/**
 * Structured errors used across siro. The CLI maps them to exit codes in one
 * place so individual commands never have to think about exit semantics.
 * The exit-code table lives in docs/configuration.md S"Exit codes" and
 * src/cli/help.ts (HELP_LINT) -- not restated here.
 *
 * One mapping note that belongs at this altitude: filesystem errno errors
 * are routed to 2 by SHAPE (numeric `errno`) in cli run(), so an
 * errno-bearing throw from a user extension also lands on 2 rather than the
 * 70 crash path -- same remedy (fix the environment) either way.
 */

export class SiroError extends Error {
  /** Recommended process exit code for this error. */
  public readonly exitCode: number;

  public constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'SiroError';
    this.exitCode = exitCode;
  }
}
