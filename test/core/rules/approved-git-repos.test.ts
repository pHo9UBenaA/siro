import { bindingForTest } from '../../helpers/rules.ts';
import { approvedGitRepos } from '../../../src/core/rules/approved-git-repos.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';

const yarnBinding = bindingForTest(approvedGitRepos, 'yarn');

describe('approved-git-repos: check states', () => {
  it('passes when approvedGitRepositories is an empty array', () => {
    expect(yarnBinding.check(makeCtx(), { approvedGitRepositories: [] }).state).toBe('ok');
  });

  it('passes when approvedGitRepositories is a non-empty array', () => {
    expect(
      yarnBinding.check(makeCtx(), {
        approvedGitRepositories: ['https://github.com/org/*'],
      }).state,
    ).toBe('ok');
  });

  it('requests manual selection of an approvedGitRepositories allowlist', () => {
    const status = yarnBinding.check(makeCtx(), {});

    expect(manualSteps(status)[0]).toContain('approvedGitRepositories');
  });
});

describe('Malformed settings', () => {
  const ctx = makeCtx();

  it.each([{ value: [false] }, { value: ['   '] }, { value: Array(1) }])(
    'does not accept malformed allowlists: %j',
    ({ value }) => {
      expect(yarnBinding.check(ctx, { approvedGitRepositories: value }).state).toBe('violation');
    },
  );
});
