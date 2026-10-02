import type { IO } from '../../core/contracts/io.ts';
import type { LintResult } from '../../core/contracts/lint-result.ts';
import type { Reporter } from '../../core/contracts/reporter.ts';
import { version } from '../../version.ts';
import { boundedJson } from './bounded-json.ts';
import { DEFAULT_SCAN_LIMITS } from '../../core/contracts/scan-limits.ts';

/**
 * Versioned machine-readable output — the public contract consumed by
 * external fixers (see docs/json-output.md). Bump `schemaVersion` on any
 * breaking shape change and update that doc in the same commit.
 */
const SCHEMA_VERSION = 3;

export const jsonReporter: Reporter<'json'> = {
  async format(result: LintResult, io: IO, context): Promise<void> {
    await io.stdout(
      boundedJson(
        {
          schemaVersion: SCHEMA_VERSION,
          siroVersion: version,
          findings: result.findings,
          summary: result.summary,
          inspection: result.inspection,
        },
        context.limits?.maxOutputBytes ?? DEFAULT_SCAN_LIMITS.maxOutputBytes,
        (context.limits?.maxConfigDepth ?? DEFAULT_SCAN_LIMITS.maxConfigDepth) + 16,
      ),
    );
  },
  name: 'json',
};
