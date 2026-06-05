import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
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
        'Consider enabling `frozenStore` in pnpm-workspace.yaml. Without it, the content-addressable store can be mutated after initial population, weakening integrity guarantees.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings#frozenstore',
  file: pnpmWorkspace,
  fix() {
    return [
      {
        file: pnpmWorkspace,
        message:
          'Set `frozenStore: true` to prevent writes to the store after initial population — especially useful in CI and deployment pipelines.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
};

export const frozenStore: Rule = {
  bindings: { pnpm: pnpmBinding },
  description:
    'Recommend enabling frozenStore to prevent mutations to the content-addressable store, strengthening supply-chain integrity in CI and deploy environments.',
  docs: 'https://pnpm.io/settings#frozenstore',
  id: 'frozen-store',
  severity: 'info',
  title: 'Enable frozen store',
};
