import type { IO } from './io.ts';
import type { LintResult } from '../entities/lint-result.ts';
import { isPlainRecord } from '../../shared/records.ts';

export interface Reporter<Name extends string = string> {
  readonly name: Name;
  format: (result: LintResult, io: IO) => void;
}

export const isReporterShape = (value: unknown): value is Reporter => {
  return (
    isPlainRecord(value) && typeof value.name === 'string' && typeof value.format === 'function'
  );
};
