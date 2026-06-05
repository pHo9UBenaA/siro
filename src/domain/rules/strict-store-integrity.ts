import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { aubeWorkspace } = CONFIG_FILES;

export const strictStoreIntegrity = requireConfigKey({
  bindings: {
    aube: {
      docs: 'https://aube.jdx.dev/settings/',
      file: aubeWorkspace,
      keyPath: ['strictStoreIntegrity'],
      message:
        'Set `strictStoreIntegrity: true` in aube-workspace.yaml to refuse tarballs that lack integrity metadata.',
      value: true,
    },
  },
  description:
    'Refuse to import tarballs from the registry when the packument lacks a dist.integrity field, preventing silent integrity bypass.',
  docs: 'https://aube.jdx.dev/security.html',
  id: 'strict-store-integrity',
  severity: 'warn',
  title: 'Require tarball integrity metadata',
});
