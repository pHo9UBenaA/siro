import { CONFIG_FILES } from '../entities/config-files.ts';
import { defineRule } from '../entities/rule.ts';
import { getByPath } from '../entities/config-value.ts';

const { aubeWorkspace } = CONFIG_FILES;

export const strictStoreIntegrity = defineRule({
  bindings: {
    aube: {
      check(_ctx, config) {
        if (getByPath(config, ['verifyStoreIntegrity']) === false) {
          return {
            actual: false,
            expected: true,
            manualSteps: [
              'Set `verifyStoreIntegrity: true` (or remove `verifyStoreIntegrity: false`) in aube-workspace.yaml, and enable `strictStoreIntegrity: true` or `paranoid: true`.',
            ],
            message:
              '`verifyStoreIntegrity: false` bypasses strict integrity checks, including when `paranoid: true`.',
            state: 'violation',
          };
        }
        const strict = getByPath(config, ['strictStoreIntegrity']);
        if (strict === true || getByPath(config, ['paranoid']) === true) {
          return { state: 'ok' };
        }
        return {
          actual: strict,
          expected: true,
          message:
            'Set `strictStoreIntegrity: true` in aube-workspace.yaml to refuse tarballs that lack integrity metadata.',
          state: 'violation',
        };
      },
      docs: 'https://aube.jdx.dev/settings/',
      file: aubeWorkspace,
      fix() {
        return [
          { file: aubeWorkspace, keyPath: ['strictStoreIntegrity'], op: 'setKey', value: true },
        ];
      },
      fixKind: 'auto',
    },
  },
  description:
    'Refuse to import tarballs from the registry when the packument lacks a dist.integrity field, preventing silent integrity bypass.',
  docs: 'https://aube.jdx.dev/security.html',
  id: 'strict-store-integrity',
  severity: 'warn',
  title: 'Require tarball integrity metadata',
});
