import type { ViolationStatus, Rule, RuleBinding } from './contracts/rule.ts';
import type { Severity } from './contracts/pms.ts';

/** Resolve the most specific severity signal for one finding. */
export const decideSeverity = (
  status: ViolationStatus,
  binding: RuleBinding,
  rule: Rule,
  userOverride?: Severity,
): Severity => userOverride ?? status.severity ?? binding.severity ?? rule.severity;
