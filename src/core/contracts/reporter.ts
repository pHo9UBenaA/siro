import type { IO } from './io.ts';
import type { LintResult } from './lint-result.ts';
import { isPlainRecord } from './records.ts';
import type { AbsPath } from './paths.ts';

export interface ReportContext {
  readonly cwd: AbsPath;
}

export interface Reporter<Name extends string = string> {
  readonly name: Name;
  format: (result: LintResult, io: IO, context: ReportContext) => void | Promise<void>;
}

export const isReporterShape = (value: unknown): value is Reporter => {
  return (
    isPlainRecord(value) && typeof value.name === 'string' && typeof value.format === 'function'
  );
};
