import type { AdvisoryRuleBinding, CheckStatus, ConfigFileRef, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { type ParsedConfig, getByPath } from '../entities/config-value.ts';

const { aubeWorkspace, pnpmWorkspace } = CONFIG_FILES;

const isNonEmptyObject = (value: unknown): boolean =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.keys(value).length > 0;

const checkOverrides = (config: ParsedConfig, file: string): CheckStatus => {
  const value = getByPath(config, ['overrides']);
  if (!isNonEmptyObject(value)) {
    return { state: 'ok' };
  }
  return {
    actual: value,
    message: `Review \`overrides\` in ${file}. Overrides can replace transitive dependencies with arbitrary versions or forks.`,
    state: 'violation',
  };
};

const makeBinding = (file: ConfigFileRef, fileName: string, docs: string): AdvisoryRuleBinding => ({
  check(_ctx, config) {
    return checkOverrides(config, fileName);
  },
  docs,
  file,
  fix() {
    return [
      {
        file,
        message:
          'Review each entry in `overrides` — verify pinned versions address a known CVE and are not redirecting to untrusted packages.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
});

export const dependencyOverrides: Rule = {
  bindings: {
    aube: makeBinding(aubeWorkspace, 'aube-workspace.yaml', 'https://aube.jdx.dev/settings.html'),
    pnpm: makeBinding(pnpmWorkspace, 'pnpm-workspace.yaml', 'https://pnpm.io/settings#overrides'),
  },
  description:
    'Flag dependency overrides that can replace transitive packages with arbitrary versions or forks — a supply-chain injection vector.',
  docs: 'https://pnpm.io/settings#overrides',
  id: 'dependency-overrides',
  severity: 'info',
  title: 'Review dependency overrides',
};
