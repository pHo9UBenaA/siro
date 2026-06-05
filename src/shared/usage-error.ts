import { SiroError } from './siro-error.ts';

const USAGE_EXIT_CODE = 2;

export class UsageError extends SiroError {
  public constructor(message: string) {
    super(message, USAGE_EXIT_CODE);
    this.name = 'UsageError';
  }
}
