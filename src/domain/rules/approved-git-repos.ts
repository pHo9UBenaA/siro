import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';
import { renderVersionNoteMessage } from './builders/require-config-key.ts';

const { yarnrc } = CONFIG_FILES;

const message = renderVersionNoteMessage(
  'Set `approvedGitRepositories: []` in .yarnrc.yml to block all git: protocol dependencies (or list approved repository globs).',
  { configAvailableSince: 'yarn 4.14.0' },
);

const yarnBinding: AdvisoryRuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['approvedGitRepositories']);
    if (Array.isArray(value)) {
      return { state: 'ok' };
    }
    return {
      actual: value,
      expected: '[]',
      message,
      state: 'violation',
    };
  },
  docs: 'https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories',
  file: yarnrc,
  fix() {
    return [
      {
        file: yarnrc,
        message:
          'Add `approvedGitRepositories: []` to .yarnrc.yml to block all git deps, or list specific approved repository URL globs.',
        op: 'note' as const,
      },
    ];
  },
  fixKind: 'advisory',
};

export const approvedGitRepos: Rule = {
  bindings: { yarn: yarnBinding },
  description:
    'Restrict git: protocol dependencies to an explicit allowlist of approved repository URL patterns.',
  docs: 'https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories',
  id: 'approved-git-repos',
  severity: 'warn',
  title: 'Approve git repository dependencies',
};
