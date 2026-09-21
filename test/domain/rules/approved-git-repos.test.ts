import assert from 'node:assert';
import { approvedGitRepos } from '../../../src/domain/rules/approved-git-repos.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';

const { yarn } = approvedGitRepos.bindings;
assert(yarn, 'expected yarn binding');
const yarnBinding = yarn;

describe('approved-git-repos: check states', () => {
  it('passes when approvedGitRepositories is an empty array', () => {
    expect.hasAssertions();
    expect(yarnBinding.check(makeCtx(), { approvedGitRepositories: [] }).state).toBe('ok');
  });

  it('passes when approvedGitRepositories is a non-empty array', () => {
    expect.hasAssertions();
    expect(
      yarnBinding.check(makeCtx(), {
        approvedGitRepositories: ['https://github.com/org/*'],
      }).state,
    ).toBe('ok');
  });

  it('reports the missing setting with its severity, scope and remediation', () => {
    const status = yarnBinding.check(makeCtx(), {});

    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
    expect(Object.keys(approvedGitRepos.bindings).sort()).toEqual(['yarn']);

    expect(approvedGitRepos.severity).toBe('warn');
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });

    const ops = manualSteps(status)!;

    const [first] = ops;
    expect(first).toContain('approvedGitRepositories');
  });
});
