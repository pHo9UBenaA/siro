import { SiroError } from './siro-error.ts';

const CONFIG_EXIT_CODE = 2;

export class ConfigError extends SiroError {
  public constructor(message: string) {
    super(message, CONFIG_EXIT_CODE);
    this.name = 'ConfigError';
  }
}
