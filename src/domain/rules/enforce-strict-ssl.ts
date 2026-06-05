import type { AutoRuleBinding, CheckStatus } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { npmrc, yarnrc } = CONFIG_FILES;

const yarnMessage =
  'Set `enableStrictSsl: true` in .yarnrc.yml to enforce SSL certificate validation for registry connections.';

const yarnBinding: AutoRuleBinding = {
  check(_ctx, config): CheckStatus {
    const strictSsl = getByPath(config, ['enableStrictSsl']);
    if (strictSsl === false) {
      return {
        actual: false,
        expected: true,
        message: yarnMessage,
        state: 'violation',
      };
    }
    const EMPTY = 0;
    const whitelist = getByPath(config, ['unsafeHttpWhitelist']);
    if (Array.isArray(whitelist) && whitelist.length > EMPTY) {
      return {
        actual: whitelist,
        expected: '',
        manualSteps: [
          'Review and remove entries from `unsafeHttpWhitelist` in .yarnrc.yml. Each entry permits unencrypted HTTP to that hostname.',
        ],
        message:
          '`unsafeHttpWhitelist` in .yarnrc.yml allows unencrypted HTTP connections — remove entries or clear the list to enforce HTTPS-only registry access.',
        state: 'violation',
      };
    }
    if (typeof strictSsl === 'undefined') {
      return {
        actual: strictSsl,
        expected: true,
        message: yarnMessage,
        severity: 'info',
        state: 'violation',
      };
    }
    return { state: 'ok' };
  },
  docs: 'https://yarnpkg.com/configuration/yarnrc#enableStrictSsl',
  file: yarnrc,
  fix() {
    return [{ file: yarnrc, keyPath: ['enableStrictSsl'], op: 'setKey', value: true }];
  },
  fixKind: 'auto',
};

const builtRule = requireConfigKey({
  bindings: {
    npm: {
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl',
      documentedDefault: true,
      file: npmrc,
      keyPath: ['strict-ssl'],
      message: 'Set `strict-ssl=true` in .npmrc to enforce SSL certificate validation.',
      value: true,
    },
  },
  description:
    'Require SSL certificate validation so registry traffic cannot be intercepted or tampered with.',
  docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#strict-ssl',
  id: 'enforce-strict-ssl',
  severity: 'warn',
  title: 'Enforce SSL for registry connections',
});

export const enforceStrictSsl = overrideBindings(builtRule, { yarn: yarnBinding });
