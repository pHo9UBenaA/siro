import { proposeChanges } from './remediation.ts';
import type { RuleBinding, CheckStatus } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { npmrc, yarnrc } = CONFIG_FILES;

const yarnMessage =
  'Set `enableStrictSsl: true` in .yarnrc.yml to enforce SSL certificate validation for registry connections.';

const yarnBinding: RuleBinding = {
  check(_ctx, config): CheckStatus {
    const strictSsl = getByPath(config, ['enableStrictSsl']);
    const whitelist = getByPath(config, ['unsafeHttpWhitelist']);
    if (Array.isArray(whitelist) && whitelist.length > 0) {
      return {
        actual: whitelist,
        expected: '',
        remediation: {
          kind: 'manual',
          steps: [
            'Review and remove entries from `unsafeHttpWhitelist` in .yarnrc.yml. Each entry permits unencrypted HTTP to that hostname. Also set `enableStrictSsl: true`.',
          ],
        },
        message:
          '`unsafeHttpWhitelist` in .yarnrc.yml allows unencrypted HTTP connections — remove entries or clear the list to enforce HTTPS-only registry access.',
        state: 'violation',
      };
    }
    if (strictSsl === true) return { state: 'ok' };
    return {
      state: 'violation',
      actual: strictSsl,
      expected: true,
      message: yarnMessage,
      ...(strictSsl === undefined ? { severity: 'info' as const } : {}),
      remediation: proposeChanges(config, [
        { file: yarnrc, keyPath: ['enableStrictSsl'], op: 'setKey', value: true },
      ]),
    };
  },
  docs: 'https://yarnpkg.com/configuration/yarnrc#enableStrictSsl',
  file: yarnrc,
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
