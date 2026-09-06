import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { yarnrc } = CONFIG_FILES;

export const hardenedMode = requireConfigKey({
  bindings: {
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#enableHardenedMode',
      // This default applies only to pull requests on public repositories.
      documentedDefault: true,
      file: yarnrc,
      keyPath: ['enableHardenedMode'],
      message:
        'yarn enables hardened mode automatically only for pull requests on public repositories — set `enableHardenedMode: true` in .yarnrc.yml to extend end-to-end install verification to every install.',
      value: true,
      versionNote: {
        configAvailableSince: 'yarn 4.0.0',
        defaultSafeSince: 'yarn 4.0.0 (conditional: auto-enabled for PRs on public repositories)',
      },
    },
  },
  description:
    "Yarn 4's enableHardenedMode performs end-to-end checksum, lockfile, and version verification at install time.",
  docs: 'https://yarnpkg.com/configuration/yarnrc#enableHardenedMode',
  id: 'hardened-mode',
  severity: 'warn',
  title: 'Enable hardened mode (yarn)',
});
