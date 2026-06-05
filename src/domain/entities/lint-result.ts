import type { ConfigReadValue, ConfigValue } from './config-value.ts';
import type { PM, Severity } from './pms.ts';
import type { FixOp } from './rule.ts';

export type { ConfigReadValue } from './config-value.ts';

export interface Finding {
  readonly ruleId: string;
  readonly pm: PM;
  readonly severity: Severity;
  readonly message: string;
  readonly file?: string;
  readonly fixable: boolean;
  /**
   * Machine-readable remediation: the binding's fix ops, verbatim. Empty
   * when `manualSteps` is present (writing the ops would be defeated by the
   * user state that produced the steps). Advisory bindings contribute their
   * `note` / `ensureFileTracked` ops here so external fixers can surface
   * them. Part of the json output contract — see docs/json-output.md.
   */
  readonly fix: readonly FixOp[];
  /** Manual remediation steps, verbatim from the check (see CheckStatus). */
  readonly manualSteps?: readonly string[];
  /**
   * Pinned to {@link ConfigValue} (no `null`) so it stays in lockstep with
   * `CheckStatus.violation.expected`. Widening to ConfigScalar would have
   * advertised a `null` outcome that no current rule can produce.
   */
  readonly expected?: ConfigValue;
  readonly actual?: ConfigReadValue;
  /** Official PM doc anchor for the setting this finding is about, if any. */
  readonly docs?: string;
}

export interface LintResult {
  readonly findings: readonly Finding[];
  readonly summary: Readonly<Record<Severity, number>>;
}
