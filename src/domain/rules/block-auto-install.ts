import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { bunfig } = CONFIG_FILES;

export const blockAutoInstall = requireConfigKey({
  bindings: {
    bun: {
      docs: 'https://bun.sh/docs/runtime/bunfig#install-auto',
      file: bunfig,
      keyPath: ['install', 'auto'],
      message:
        'Set `auto = "disable"` under [install] in bunfig.toml to prevent auto-install from bypassing security guards.',
      value: 'disable',
    },
  },
  description:
    'Disable auto-install so dependencies are only installed through an explicit install step where security guards apply.',
  docs: 'https://bun.sh/docs/runtime/bunfig#install-auto',
  id: 'block-auto-install',
  severity: 'warn',
  title: 'Block automatic package installation',
});
