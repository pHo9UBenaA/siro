import { type RuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { pnpmWorkspace } = CONFIG_FILES;

const isNonEmptyObject = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

const pnpmBinding: RuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['patchedDependencies']);
    if (!isNonEmptyObject(value)) {
      return { state: 'ok' };
    }
    return {
      remediation: {
        kind: 'manual',
        steps: [
          'Review each entry in `patchedDependencies` — verify patches address a known issue and have not been tampered with.',
        ],
      },
      actual: value,
      message:
        'Review `patchedDependencies` in pnpm-workspace.yaml. Local patches modify dependency code after the registry artifact is verified; review the patch files separately.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings#patcheddependencies',
  file: pnpmWorkspace,
};

export const patchedDependencies = defineRule({
  bindings: { pnpm: pnpmBinding },
  description: 'Review local patches separately from the registry artifacts they modify.',
  docs: 'https://pnpm.io/settings#patcheddependencies',
  id: 'patched-dependencies',
  severity: 'info',
  title: 'Review patched dependencies',
});
