import type { CheckStatus, Rule, RuleBinding } from '../../core/contracts/rule.ts';
import type { Severity } from '../../core/contracts/pms.ts';

type Violation = Extract<CheckStatus, { state: 'violation' }>;

/** Resolve the most specific severity signal for one finding. */
export const decideSeverity = (
  status: Violation,
  binding: RuleBinding,
  rule: Rule,
  userOverride?: Severity,
): Severity => userOverride ?? status.severity ?? binding.severity ?? rule.severity;
