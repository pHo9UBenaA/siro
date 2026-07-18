import type { IO } from '../../domain/ports/io.ts';
import type { LintResult } from '../../domain/entities/lint-result.ts';
import type { Reporter } from '../../domain/ports/reporter.ts';
import { version } from '../../version.ts';

/**
 * Versioned machine-readable output — the public contract consumed by
 * external fixers (see docs/json-output.md). Bump `schemaVersion` on any
 * breaking shape change and update that doc in the same commit.
 */
export const SCHEMA_VERSION = 1;
const JSON_INDENT = 2;

export const jsonReporter: Reporter<'json'> = {
  format(result: LintResult, io: IO): void {
    io.stdout(
      JSON.stringify(
        { schemaVersion: SCHEMA_VERSION, siroVersion: version, ...result },
        void 0,
        JSON_INDENT,
      ),
    );
  },
  name: 'json',
};
