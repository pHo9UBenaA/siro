import type { Rule } from '../../entities/rule.ts';
import { getByPath } from '../../entities/config-value.ts';
import { overrideBindings } from './require-config-key.ts';

export const withAubeParanoid = <Id extends string>(rule: Rule<Id>): Rule<Id> => {
  const { aube } = rule.bindings;
  if (!aube) {
    return rule;
  }
  return overrideBindings(rule, {
    aube: {
      ...aube,
      check(ctx, config) {
        if (getByPath(config, ['paranoid']) === true) {
          return { state: 'ok' };
        }
        return aube.check(ctx, config);
      },
    },
  });
};
