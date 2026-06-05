import type { IO } from './io.ts';
import type { LintResult } from '../entities/lint-result.ts';

/**
 * Renderer from `LintResult` to user-facing output.
 *
 * Reporters never touch the filesystem and never spawn processes — every
 * output byte flows through the injected `IO` port. They MAY however
 * consult `process.env` for environmental shape (TTY colour support,
 * NO_COLOR / FORCE_COLOR, CI detection) because that information has no
 * `IO`-port equivalent and treating it as I/O would force the application
 * layer to thread a snapshot through every call site for a value the
 * adapter can read in a single line.
 *
 * Implementations live in the adapter layer (src/adapters/reporters/),
 * so the env access stays out of the domain.
 */
export interface Reporter<Name extends string = string> {
  readonly name: Name;
  format: (result: LintResult, io: IO) => void;
}

/**
 * Structural guard for an embedder-supplied reporter. The `Reporter` contract
 * is compile-time only (`defineConfig` / typed options), so a hand-written JS
 * config or a dynamically-built object can still pass a malformed value; this
 * lets each boundary reject it with its own error type before `format` is
 * called on something that isn't a function.
 */
export const isReporterShape = (value: unknown): value is Reporter => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (!('name' in value) || typeof value.name !== 'string') {
    return false;
  }
  return 'format' in value && typeof value.format === 'function';
};
