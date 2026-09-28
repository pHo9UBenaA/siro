import type { IO } from '../../core/contracts/io.ts';
import type { LintResult } from '../../core/contracts/lint-result.ts';
import type { Reporter } from '../../core/contracts/reporter.ts';
import { version } from '../../version.ts';
import { safeJsonText } from '../safe-text.ts';

/**
 * Versioned machine-readable output — the public contract consumed by
 * external fixers (see docs/json-output.md). Bump `schemaVersion` on any
 * breaking shape change and update that doc in the same commit.
 */
const SCHEMA_VERSION = 3;

export const jsonReporter: Reporter<'json'> = {
  async format(result: LintResult, io: IO): Promise<void> {
    await io.stdout(
      safeJsonText(
        JSON.stringify(
          {
            schemaVersion: SCHEMA_VERSION,
            siroVersion: version,
            findings: result.findings,
            summary: result.summary,
            inspection: result.inspection,
          },
          void 0,
          2,
        ),
      ),
    );
  },
  name: 'json',
};
