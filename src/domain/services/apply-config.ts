import type { CheckStatus, Rule, RuleBinding } from '../entities/rule.ts';
import { type PM, PMS, type Severity } from '../entities/pms.ts';
import type { SiroConfig } from '../entities/siro-config.ts';

const stripDynamicSeverity =
  (check: RuleBinding['check']): RuleBinding['check'] =>
  (ctx, config) => {
    const status = check(ctx, config);
    if (status.state === 'violation' && typeof status.severity !== 'undefined') {
      const result: CheckStatus = {
        actual: status.actual,
        expected: status.expected,
        manualSteps: status.manualSteps,
        message: status.message,
        state: 'violation',
      };
      return result;
    }
    return status;
  };

/**
 * Rewrite all bindings of a rule to strip dynamic and per-binding severity,
 * so the user's config-level severity override is the sole authority.
 */
const rewriteBindingsForSeverityOverride = (rule: Rule, override: Severity): Rule => {
  // User config severity is the highest-priority signal. We rewrite
  // rule.severity, strip per-binding severity, AND wrap each binding's
  // `check` so any dynamic `CheckStatus.severity` it emits is stripped
  // too. Without the wrap, a binding using `documentedDefault` would
  // still down-grade the user's chosen severity to `'info'`.
  const bindings: Partial<Record<PM, Rule['bindings'][PM]>> = {};
  // Iterate the canonical `PMS` tuple rather than `Object.keys(rule.bindings)`
  // so the loop is exhaustive against the source-of-truth PM list and stays
  // safe even if a customRule's bindings object accidentally carries an
  // off-spec key.
  for (const pm of PMS) {
    const binding = rule.bindings[pm];
    if (typeof binding !== 'undefined') {
      bindings[pm] = {
        ...binding,
        check: stripDynamicSeverity(binding.check),
        severity: void 0,
      };
    }
  }
  return { ...rule, bindings, severity: override };
};

const applyOverride = (
  rule: Rule,
  overrides: NonNullable<SiroConfig['rules']>,
  out: Rule[],
): void => {
  let override: Severity | 'off' | undefined = void 0;
  if (Object.hasOwn(overrides, rule.id)) {
    override = overrides[rule.id];
  }
  if (override === 'off') {
    return;
  }
  if (typeof override === 'undefined') {
    out.push(rule);
  } else {
    out.push(rewriteBindingsForSeverityOverride(rule, override));
  }
};

const mergeBase = (base: readonly Rule[], config?: SiroConfig): Rule[] => {
  const customRules = config?.customRules;
  return [...base, ...(customRules ?? [])];
};

export const applyConfig = (base: readonly Rule[], config?: SiroConfig): Rule[] => {
  const merged = mergeBase(base, config);
  const overrides = config?.rules;
  if (typeof overrides === 'undefined') {
    return merged;
  }
  const out: Rule[] = [];
  for (const rule of merged) {
    applyOverride(rule, overrides, out);
  }
  return out;
};
