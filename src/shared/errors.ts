import { ConfigError } from './config-error.ts';
import { SiroError } from './siro-error.ts';
import { UsageError } from './usage-error.ts';

export { ConfigError, SiroError, UsageError };

/**
 * Run `fn` and wrap any non-`ConfigError` failure as a `ConfigError` prefixed
 * with `filePath`. Codec `parse` calls hit raw libraries that
 * throw bare `Error`s; without this wrap the CLI would surface those as
 * exit-1 internal errors and break CI that branches on exit codes. A
 * `ConfigError` that bubbles up from a nested call is re-thrown unchanged so
 * the original `path: message` framing is preserved.
 */
export const wrapCodecError = <TResult>(filePath: string, fn: () => TResult): TResult => {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    let msg = String(error);
    if (error instanceof Error) {
      msg = error.message;
    }
    throw new ConfigError(`${filePath}: ${msg}`);
  }
};
