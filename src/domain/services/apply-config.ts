import type { Rule } from '../entities/rule.ts';
import type { Severity } from '../entities/pms.ts';
import type { SiroConfig } from '../entities/siro-config.ts';

export interface AppliedConfig {
  readonly rules: readonly Rule[];
  readonly severityOverrides: ReadonlyMap<string, Severity>;
}

/** Select active rules and keep user severity choices as explicit runtime data. */
export const applyConfig = (base: readonly Rule[], config?: SiroConfig): AppliedConfig => {
  const merged = [...base, ...(config?.customRules ?? [])];
  const activeRules: Rule[] = [];
  const severityOverrides = new Map<string, Severity>();
  const overrides = config?.rules;

  for (const rule of merged) {
    const override =
      overrides && Object.hasOwn(overrides, rule.id) ? overrides[rule.id] : undefined;
    if (override === 'off') {
      continue;
    }
    activeRules.push(rule);
    if (override !== undefined) {
      severityOverrides.set(rule.id, override);
    }
  }

  return { rules: activeRules, severityOverrides };
};
