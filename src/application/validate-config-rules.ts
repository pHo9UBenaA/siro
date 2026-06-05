import { ConfigError } from '../shared/errors.ts';
import type { Rule } from '../domain/entities/rule.ts';
import type { SiroConfig } from '../domain/entities/siro-config.ts';
import { rules as builtinRules } from '../domain/builtin-rules.ts';
import { validateRuleIds } from '../domain/services/validate-rule-ids.ts';

const EMPTY = 0;
const SINGLE = 1;

const throwUnknownIds = (unknown: readonly string[]): void => {
  let plural = '';
  if (unknown.length > SINGLE) {
    plural = 's';
  }
  throw new ConfigError(
    `siro.config: unknown rule id${plural} in rules: ${unknown.map((id: string) => `'${id}'`).join(', ')}`,
  );
};

export const assertConfigRuleIdsKnown = (
  userConfig?: SiroConfig,
  programmaticRules?: readonly Rule[],
): void => {
  if (typeof userConfig === 'undefined') {
    return;
  }
  const programmaticIds = (programmaticRules ?? []).map((rule) => rule.id);
  const { unknown } = validateRuleIds(userConfig, builtinRules, programmaticIds);
  if (unknown.length > EMPTY) {
    throwUnknownIds(unknown);
  }
};
