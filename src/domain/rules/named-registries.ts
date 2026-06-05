import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { pnpmWorkspace } = CONFIG_FILES;

const isNonEmptyObject = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

const pnpmBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['namedRegistries']);
    if (!isNonEmptyObject(value)) {
      return { state: 'ok' };
    }
    return {
      actual: value,
      message:
        'Review `namedRegistries` in pnpm-workspace.yaml. Custom registry mappings can redirect package resolution away from the public registry, enabling dependency confusion attacks.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings#namedregistries',
  file: pnpmWorkspace,
  fix() {
    return [
      {
        file: pnpmWorkspace,
        message:
          'Verify each named registry points to a trusted source and that scoped packages cannot be hijacked via a public registry of the same name.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
};

export const namedRegistries: Rule = {
  bindings: { pnpm: pnpmBinding },
  description:
    'Flag named registry mappings that redirect package resolution to custom registries, which may enable dependency confusion attacks.',
  docs: 'https://pnpm.io/settings#namedregistries',
  id: 'named-registries',
  severity: 'info',
  title: 'Review named registry mappings',
};
