import { CONFIG_FILES } from '../entities/config-files.ts';
import { defineRule } from '../entities/rule.ts';
import { getByPath } from '../entities/config-value.ts';

const { npmrc } = CONFIG_FILES;

export const strictAllowScripts = defineRule({
  bindings: {
    npm: {
      check(_ctx, config) {
        if (getByPath(config, ['ignore-scripts']) === true) {
          return { state: 'ok' };
        }
        const bypass = getByPath(config, ['dangerously-allow-all-scripts']);
        if (bypass === true) {
          return {
            actual: bypass,
            expected: false,
            manualSteps: [
              'Remove `dangerously-allow-all-scripts=true` from .npmrc (or set it to false), then set `strict-allow-scripts=true`. The bypass overrides strict script approval.',
            ],
            message:
              '`dangerously-allow-all-scripts=true` bypasses script approval even when `strict-allow-scripts=true`.',
            state: 'violation',
          };
        }
        const strict = getByPath(config, ['strict-allow-scripts']);
        if (strict === true) {
          return { state: 'ok' };
        }
        return {
          actual: strict,
          expected: true,
          message:
            'Set `strict-allow-scripts=true` in .npmrc to fail installation for unreviewed install scripts.',
          state: 'violation',
        };
      },
      docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#strict-allow-scripts',
      file: npmrc,
      fix() {
        return [{ file: npmrc, keyPath: ['strict-allow-scripts'], op: 'setKey', value: true }];
      },
      fixKind: 'auto',
    },
  },
  description:
    'Turn install-script policy warnings into hard errors so unapproved lifecycle scripts block installation.',
  docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#strict-allow-scripts',
  id: 'strict-allow-scripts',
  severity: 'warn',
  title: 'Require explicit script allow-listing',
});
