import { type AdvisoryRuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { pnpmWorkspace } = CONFIG_FILES;

const pnpmBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['frozenStore']);
    if (value === true) {
      return { state: 'ok' };
    }
    return {
      actual: value,
      message:
        'For a pre-populated read-only store, consider `frozenStore` in pnpm-workspace.yaml. Normal installs need a writable store.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings/store#frozenstore',
  file: pnpmWorkspace,
  fix() {
    return [
      {
        file: pnpmWorkspace,
        message:
          'Populate the store before enabling `frozenStore: true`. Use it for read-only deployments; it is incompatible with --force and a configured pnpr server.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
  versionNote: { configAvailableSince: 'pnpm 11.7.0' },
};

export const frozenStore = defineRule({
  bindings: { pnpm: pnpmBinding },
  description:
    'Consider read-only store access for deployments whose dependencies are already present.',
  docs: 'https://pnpm.io/settings/store#frozenstore',
  id: 'frozen-store',
  severity: 'info',
  title: 'Consider a pre-populated read-only store',
});
