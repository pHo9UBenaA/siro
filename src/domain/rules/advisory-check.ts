import { CONFIG_FILES } from '../entities/config-files.ts';
import { requireConfigKey } from './builders/require-config-key.ts';

const { aubeWorkspace } = CONFIG_FILES;

export const advisoryCheck = requireConfigKey({
  bindings: {
    aube: {
      accept: (value: unknown): boolean => value === 'on' || value === 'required',
      docs: 'https://aube.jdx.dev/security.html',
      file: aubeWorkspace,
      keyPath: ['advisoryCheck'],
      message:
        'Set `advisoryCheck: on` (or `required`) in aube-workspace.yaml to check dependencies against known-malicious advisories.',
      value: 'on',
    },
  },
  description: 'Query the OSV database for known-malicious packages during dependency resolution.',
  docs: 'https://aube.jdx.dev/security.html',
  id: 'advisory-check',
  severity: 'warn',
  title: 'Enable malicious-package advisory checks',
});
