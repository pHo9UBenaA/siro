import type { ConfigReadValue, ConfigValue } from './config-value.ts';
import type { PM, Severity } from './pms.ts';
import type { Remediation } from './rule.ts';

export type { ConfigReadValue } from './config-value.ts';

export interface Finding {
  readonly ruleId: string;
  readonly pm: PM;
  readonly severity: Severity;
  readonly message: string;
  readonly file?: string;
  readonly remediation?: Remediation;
  readonly expected?: ConfigValue;
  readonly actual?: ConfigReadValue;
  /** Official PM doc anchor for the setting this finding is about, if any. */
  readonly docs?: string;
}

export interface LintResult {
  readonly findings: readonly Finding[];
  readonly summary: Readonly<Record<Severity, number>>;
}
