import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { aubeWorkspace } = CONFIG_FILES;

export const strictReleaseAge = requireConfigKey({
  bindings: {
    aube: {
      docs: 'https://aube.jdx.dev/settings/',
      file: aubeWorkspace,
      keyPath: ['minimumReleaseAgeStrict'],
      message:
        'Set `minimumReleaseAgeStrict: true` in aube-workspace.yaml to make the release age gate a hard block.',
      value: true,
    },
  },
  description:
    'Make the minimum release age gate a hard failure instead of falling back to the next-oldest satisfying version.',
  docs: 'https://aube.jdx.dev/security.html',
  id: 'strict-release-age',
  severity: 'info',
  title: 'Enforce strict release age gate',
});
