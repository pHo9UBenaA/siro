import { ConfigError } from './contracts/errors.ts';
import type { Rule } from './contracts/rule.ts';
import type { Severity } from './contracts/pms.ts';
import type { SiroConfig } from './siro-config.ts';

export interface AppliedConfig {
  readonly rules: readonly Rule[];
  readonly severityOverrides: ReadonlyMap<string, Severity>;
}

/** Select active rules and keep user severity choices as explicit runtime data. */
export const applyConfig = (baseRules: readonly Rule[], config?: SiroConfig): AppliedConfig => {
  const mergedRules = [...baseRules, ...(config?.customRules ?? [])];
  const knownRuleIds = new Set<string>();
  const duplicateRuleIds = new Set<string>();
  for (const rule of mergedRules) {
    if (knownRuleIds.has(rule.id)) duplicateRuleIds.add(rule.id);
    knownRuleIds.add(rule.id);
  }
  if (duplicateRuleIds.size > 0) {
    throw new ConfigError(
      `Duplicate rule ids: ${Array.from(duplicateRuleIds, (id) => `'${id}'`).join(', ')}`,
    );
  }
  const unknownRuleLabels: string[] = [];
  for (const id of Object.keys(config?.rules ?? {})) {
    if (!knownRuleIds.has(id)) unknownRuleLabels.push(`'${id}'`);
  }
  if (unknownRuleLabels.length > 0) {
    throw new ConfigError(`Unknown rule ids: ${unknownRuleLabels.join(', ')}`);
  }
  const activeRules: Rule[] = [];
  const severityOverrides = new Map<string, Severity>();
  const overrides = config?.rules;

  for (const rule of mergedRules) {
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
