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
    const value = getByPath(config, ['patchedDependencies']);
    if (!isNonEmptyObject(value)) {
      return { state: 'ok' };
    }
    return {
      actual: value,
      message:
        'Review `patchedDependencies` in pnpm-workspace.yaml. Patches modify dependency source code directly and bypass registry integrity checks.',
      state: 'violation',
    };
  },
  docs: 'https://pnpm.io/settings#patcheddependencies',
  file: pnpmWorkspace,
  fix() {
    return [
      {
        file: pnpmWorkspace,
        message:
          'Review each entry in `patchedDependencies` — verify patches address a known issue and have not been tampered with.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
};

export const patchedDependencies: Rule = {
  bindings: { pnpm: pnpmBinding },
  description:
    'Flag patched dependencies whose source code is modified by local patch files, bypassing registry integrity verification.',
  docs: 'https://pnpm.io/settings#patcheddependencies',
  id: 'patched-dependencies',
  severity: 'info',
  title: 'Review patched dependencies',
};
