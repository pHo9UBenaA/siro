import type { Rule } from '../entities/rule.ts';
import type { SiroConfig } from '../entities/siro-config.ts';

/**
 * Result of `validateRuleIds`. `duplicates` carries customRule ids that
 * collide with a builtin or repeat within `customRules`; `unknown` carries
 * `rules` keys that match neither a builtin nor a customRule id. Both are
 * preserved in first-occurrence order so error messages stay deterministic.
 */
export interface RuleIdValidation {
  readonly duplicates: readonly string[];
  readonly unknown: readonly string[];
}

/**
 * Cross-check a loaded SiroConfig against the registered builtin rules.
 *
 * Pure: no I/O, no globals, takes builtins as an argument so it stays
 * testable and so the domain layer doesn't reach for `builtin-rules.ts`
 * via a hidden static dependency. Callers (the adapters-layer loadConfig
 * and the application-layer assertConfigRuleIdsKnown) pass the builtin
 * list explicitly.
 *
 * Why both checks in one pass? `duplicates` must be detected against the
 * builtin set *before* `unknown` consults the merged (builtin ∪ custom)
 * set — otherwise a colliding customRule id silently widens the known
 * set and a typo in `rules` aimed at that id is no longer flagged.
 */
const detectDuplicates = (
  customRules: readonly Rule[],
  builtinIds: ReadonlySet<string>,
): readonly string[] => {
  const duplicateSet = new Set<string>();
  const seen = new Set<string>();
  for (const rule of customRules) {
    if (builtinIds.has(rule.id) || seen.has(rule.id)) {
      duplicateSet.add(rule.id);
    }
    seen.add(rule.id);
  }
  return [...duplicateSet];
};

const detectUnknown = (
  rules: Readonly<Record<string, unknown>>,
  known: ReadonlySet<string>,
): readonly string[] => {
  const unknown: string[] = [];
  for (const id of Object.keys(rules)) {
    if (!known.has(id)) {
      unknown.push(id);
    }
  }
  return unknown;
};

export const validateRuleIds = (
  config: SiroConfig,
  builtins: readonly Rule[],
  extraKnownIds: readonly string[] = [],
): RuleIdValidation => {
  const builtinIds = new Set(builtins.map((rule) => rule.id));
  const customRules = config.customRules ?? [];
  const duplicates = detectDuplicates(customRules, builtinIds);

  const known = new Set<string>(builtinIds);
  for (const id of extraKnownIds) {
    known.add(id);
  }
  for (const rule of customRules) {
    known.add(rule.id);
  }

  const unknown = detectUnknown(config.rules ?? {}, known);
  return { duplicates, unknown };
};
