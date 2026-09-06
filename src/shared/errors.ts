export class SiroError extends Error {
  public readonly exitCode: number;
  public constructor(message: string, exitCode: number) {
    super(message);
    this.name = 'SiroError';
    this.exitCode = exitCode;
  }
}

export class ConfigError extends SiroError {
  public constructor(message: string) {
    super(message, 2);
    this.name = 'ConfigError';
  }
}

export class UsageError extends SiroError {
  public constructor(message: string) {
    super(message, 2);
    this.name = 'UsageError';
  }
}

/**
 * Run `fn` and wrap any non-`ConfigError` failure as a `ConfigError` prefixed
 * with `filePath`. A `ConfigError` that bubbles up from a nested call is re-thrown unchanged so
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
