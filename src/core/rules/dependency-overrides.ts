import { type RuleBinding, type CheckStatus, defineRule } from '../contracts/rule.ts';
import type { ConfigFileRef } from '../contracts/config-file-ref.ts';
import { CONFIG_FILES } from '../config-files.ts';
import { type ParsedConfig, getByPath } from '../contracts/config-value.ts';
import { isNonEmptyObject } from './config-predicates.ts';

const { aubeWorkspace, pnpmWorkspace } = CONFIG_FILES;

const checkOverrides = (config: ParsedConfig, file: string): CheckStatus => {
  const value = getByPath(config, ['overrides']);
  if (!isNonEmptyObject(value)) {
    return { state: 'ok' };
  }
  return {
    actual: value,
    message: `Review \`overrides\` in ${file}. Overrides can replace transitive dependencies with arbitrary versions or forks.`,
    state: 'violation',
    remediation: {
      kind: 'manual',
      steps: [
        'Review each entry in `overrides` — verify pinned versions address a known CVE and are not redirecting to untrusted packages.',
      ],
    },
  };
};

const makeBinding = (file: ConfigFileRef, docs: string): RuleBinding => ({
  check(_ctx, config) {
    return checkOverrides(config, file.path);
  },
  docs,
  file,
});

export const dependencyOverrides = defineRule({
  bindings: {
    aube: makeBinding(aubeWorkspace, 'https://aube.sh/settings/'),
    pnpm: makeBinding(pnpmWorkspace, 'https://pnpm.io/settings/dependency-resolution#overrides'),
  },
  description:
    'Flag dependency overrides that can replace transitive packages with arbitrary versions or forks — a supply-chain injection vector.',
  docs: 'https://pnpm.io/settings/dependency-resolution#overrides',
  id: 'dependency-overrides',
  severity: 'info',
  title: 'Review dependency overrides',
});
