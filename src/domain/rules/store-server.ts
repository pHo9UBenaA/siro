import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { pnpmWorkspace } = CONFIG_FILES;

const pnpmBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['useRunningStoreServer']);
    if (value !== true) {
      return { state: 'ok' };
    }
    return {
      actual: value,
      message:
        'Review `useRunningStoreServer` in pnpm-workspace.yaml. Delegating store operations to an external process introduces a trust boundary — the server process can serve tampered packages.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings#userunningStoreserver',
  file: pnpmWorkspace,
  fix() {
    return [
      {
        file: pnpmWorkspace,
        message:
          'Verify the store server is running in a trusted environment and that its communication channel is not exposed to untrusted networks.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
};

export const storeServer: Rule = {
  bindings: { pnpm: pnpmBinding },
  description:
    'Flag use of an external store server process, which introduces a trust boundary where tampered packages could be served.',
  docs: 'https://pnpm.io/settings#userunningStoreserver',
  id: 'store-server',
  severity: 'info',
  title: 'Review store server usage',
};
