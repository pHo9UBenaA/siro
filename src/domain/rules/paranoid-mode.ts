import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { aubeWorkspace } = CONFIG_FILES;

export const paranoidMode = requireConfigKey({
  bindings: {
    aube: {
      docs: 'https://aube.jdx.dev/security.html',
      file: aubeWorkspace,
      keyPath: ['paranoid'],
      message:
        'Set `paranoid: true` in aube-workspace.yaml to enable the strict-security bundle (trustPolicy, jailBuilds, minimumReleaseAgeStrict, strictStoreIntegrity, strictDepBuilds, advisoryCheck).',
      value: true,
    },
  },
  description:
    'Activate the strict-security setting bundle that forces trustPolicy, jailBuilds, minimumReleaseAgeStrict, strictStoreIntegrity, strictDepBuilds, and advisoryCheck on in one switch.',
  docs: 'https://aube.jdx.dev/security.html',
  id: 'paranoid-mode',
  severity: 'info',
  title: 'Enable paranoid security mode',
});
