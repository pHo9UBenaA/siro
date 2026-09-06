import { type RuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { pnpmWorkspace } = CONFIG_FILES;

const pnpmBinding: RuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['useRunningStoreServer']);
    if (value !== true) {
      return { state: 'ok' };
    }
    return {
      remediation: {
        kind: 'manual',
        steps: [
          'Verify the store server is running in a trusted environment and that its communication channel is not exposed to untrusted networks.',
        ],
      },
      actual: value,
      message:
        'Review `useRunningStoreServer` in pnpm-workspace.yaml. Delegating store operations to an external process introduces a trust boundary — the server process can serve tampered packages.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings#userunningStoreserver',
  file: pnpmWorkspace,
};

export const storeServer = defineRule({
  bindings: { pnpm: pnpmBinding },
  description:
    'Flag use of an external store server process, which introduces a trust boundary where tampered packages could be served.',
  docs: 'https://pnpm.io/settings#userunningStoreserver',
  id: 'store-server',
  severity: 'info',
  title: 'Review store server usage',
});
