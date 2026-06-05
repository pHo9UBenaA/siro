import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { aubeWorkspace, pnpmWorkspace } = CONFIG_FILES;

export const trustPolicy = requireConfigKey({
  bindings: {
    aube: {
      docs: 'https://aube.jdx.dev/security.html',
      file: aubeWorkspace,
      keyPath: ['trustPolicy'],
      message:
        'Set `trustPolicy: no-downgrade` in aube-workspace.yaml to block packages whose trust level has decreased.',
      value: 'no-downgrade',
    },
    pnpm: {
      docs: 'https://pnpm.io/settings#trustpolicy',
      file: pnpmWorkspace,
      keyPath: ['trustPolicy'],
      message:
        'Set `trustPolicy: no-downgrade` in pnpm-workspace.yaml to block packages whose trust level has decreased.',
      value: 'no-downgrade',
      versionNote: { configAvailableSince: 'pnpm 10.21.0' },
    },
  },
  description:
    'Fail installation when a package trust level has decreased compared to previous releases, catching publisher credential downgrades.',
  docs: 'https://pnpm.io/settings#trustpolicy',
  id: 'trust-policy',
  severity: 'warn',
  title: 'Enforce trust policy on dependency updates',
});
