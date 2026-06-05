import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { npmrc } = CONFIG_FILES;

export const strictAllowScripts = requireConfigKey({
  bindings: {
    npm: {
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#strict-allow-scripts',
      file: npmrc,
      keyPath: ['strict-allow-scripts'],
      message:
        'Set `strict-allow-scripts=true` in .npmrc to block packages with unapproved install scripts.',
      value: true,
    },
  },
  description:
    'Turn install-script policy warnings into hard errors so unapproved lifecycle scripts block installation.',
  docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#strict-allow-scripts',
  id: 'strict-allow-scripts',
  severity: 'warn',
  title: 'Require explicit script allow-listing',
});
