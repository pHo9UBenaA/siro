import { isStringList } from './config-predicates.ts';
import { type RuleBinding, defineRule } from '../entities/rule.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { yarnrc } = CONFIG_FILES;

const message =
  'Set `approvedGitRepositories: []` in .yarnrc.yml to block all git: protocol dependencies (or list approved repository globs).';

const yarnBinding: RuleBinding = {
  check(_ctx, config) {
    const value = getByPath(config, ['approvedGitRepositories']);
    if (isStringList(value)) {
      return { state: 'ok' };
    }
    return {
      remediation: {
        kind: 'manual',
        steps: [
          'Add `approvedGitRepositories: []` to .yarnrc.yml to block all git deps, or list specific approved repository URL globs.',
        ],
      },
      actual: value,
      expected: '[]',
      message,
      state: 'violation',
    };
  },
  docs: 'https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories',
  file: yarnrc,

  versionNote: { configAvailableSince: 'yarn 4.14.0' },
};

export const approvedGitRepos = defineRule({
  bindings: { yarn: yarnBinding },
  description:
    'Restrict git: protocol dependencies to an explicit allowlist of approved repository URL patterns.',
  docs: 'https://yarnpkg.com/configuration/yarnrc#approvedGitRepositories',
  id: 'approved-git-repos',
  severity: 'warn',
  title: 'Approve git repository dependencies',
});
