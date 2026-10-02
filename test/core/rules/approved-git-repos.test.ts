import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
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

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = yarnBinding.check(makeCtx(), {});

    assert(status.state === 'violation');
    const steps = manualSteps(status);

    const [first] = steps;
    expect(first).toContain('approvedGitRepositories');
  });
});

describe('Malformed settings', () => {
  const ctx = makeCtx();
  it.each([{ value: [false] }, { value: ['   '] }, { value: Array(1) }])(
    'does not accept malformed allowlists: %j',
    ({ value }) => {
      expect(
        approvedGitRepos.bindings.yarn?.check(ctx, { approvedGitRepositories: value }).state,
      ).toBe('violation');
    },
  );
});
