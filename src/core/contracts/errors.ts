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

/** Parser diagnostics constructed from constant classifications, never source excerpts. */
export class ConfigParseError extends Error {}

/** Prefix sanitized parser failures with the file path; preserve existing ConfigErrors. */
export const wrapCodecError = <TResult>(filePath: string, parse: () => TResult): TResult => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    // Unknown parser exceptions can contain source lines, values, or secrets.
    const message = error instanceof ConfigParseError ? error.message : 'Invalid configuration.';
    throw new ConfigError(`${filePath}: ${message}`);
  }
};
