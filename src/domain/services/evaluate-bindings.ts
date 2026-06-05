import type { CheckStatus, Rule, RuleBinding } from '../entities/rule.ts';
import type { ConfigParser } from './parse-config-file.ts';
import type { PM } from '../entities/pms.ts';
import type { RepoContext } from '../ports/repo-context.ts';

type Violation = Extract<CheckStatus, { state: 'violation' }>;

/** One `(rule, pm)` binding evaluation that produced a violation. */
export interface BindingVisit {
  readonly rule: Rule;
  readonly pm: PM;
  readonly binding: RuleBinding;
  readonly status: Violation;
}

export interface EvaluateBindingsOptions {
  readonly ctx: RepoContext;
  readonly pms: readonly PM[];
  readonly ruleSet: readonly Rule[];
  readonly parseConfig: ConfigParser;
  readonly onViolation: (visit: BindingVisit) => void;
}

/**
 * Iterate every applicable `(rule, pm)` binding, run its check, and hand
 * each violation to `onViolation`. Folding the loop into one place keeps
 * the rule-evaluation contract (parse once, run check, gate on violation)
 * in a single location so the call site (`runLint`) stays declarative.
 */
export const evaluateBindings = (opts: EvaluateBindingsOptions): void => {
  const { ctx, pms, ruleSet, parseConfig, onViolation } = opts;
  for (const rule of ruleSet) {
    for (const pm of pms) {
      const binding = rule.bindings[pm];
      if (typeof binding !== 'undefined') {
        const { parsed } = parseConfig(ctx, binding.file);
        const status = binding.check(ctx, parsed);
        if (status.state === 'violation') {
          onViolation({ binding, pm, rule, status });
        }
      }
    }
  }
};
