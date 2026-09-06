import { ConfigError } from '../../shared/errors.ts';
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
  const known = new Set<string>();
  const duplicates = new Set<string>();
  for (const rule of merged) {
    if (known.has(rule.id)) duplicates.add(rule.id);
    known.add(rule.id);
  }
  if (duplicates.size > 0) {
    throw new ConfigError(
      `Duplicate rule ids: ${[...duplicates].map((id) => `'${id}'`).join(', ')}`,
    );
  }
  const unknown = Object.keys(config?.rules ?? {}).filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new ConfigError(`Unknown rule ids: ${unknown.map((id) => `'${id}'`).join(', ')}`);
  }
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
