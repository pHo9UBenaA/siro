import type { CheckStatus, Rule, RuleBinding } from '../entities/rule.ts';
import type { Severity } from '../entities/pms.ts';

type Violation = Extract<CheckStatus, { state: 'violation' }>;

/**
 * A user `rules` override is NOT consulted here: `applyConfig` rewrites
 * `rule.severity` to the user's choice AND strips `binding.severity` +
 * dynamic `status.severity` before this function ever runs, so a single
 * three-source resolution suffices at the call site.
 */
export const decideSeverity = (status: Violation, binding: RuleBinding, rule: Rule): Severity =>
  status.severity ?? binding.severity ?? rule.severity;
