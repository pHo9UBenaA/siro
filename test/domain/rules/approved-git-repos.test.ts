import assert from 'node:assert';
import { expectMessageContains } from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { approvedGitRepos } from '../../../src/domain/rules/approved-git-repos.ts';

vi.setConfig({ testTimeout: 5000 });

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

  it('flags a violation when key is unset', () => {
    expect.hasAssertions();
    const status = yarnBinding.check(makeCtx(), {});
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
  });
});

describe('approved-git-repos: scope, metadata, and fix', () => {
  it('only binds to yarn', () => {
    expect.hasAssertions();
    expect(approvedGitRepos.bindings.npm).toBeUndefined();
    expect(approvedGitRepos.bindings.pnpm).toBeUndefined();
    expect(approvedGitRepos.bindings.bun).toBeUndefined();
    expect(approvedGitRepos.bindings.deno).toBeUndefined();
    expect(approvedGitRepos.bindings.aube).toBeUndefined();
    expect(approvedGitRepos.bindings.yarn).toBeDefined();
  });

  it('ships at warn severity and targets .yarnrc.yml', () => {
    expect.hasAssertions();
    expect(approvedGitRepos.severity).toBe('warn');
    expect(yarnBinding.file).toStrictEqual({ kind: 'yaml', path: '.yarnrc.yml' });
  });

  it('is an advisory binding', () => {
    expect.hasAssertions();
    expect(yarnBinding.fixKind).toBe('advisory');
  });

  it('includes version note in violation message', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: yarnBinding,
      ctx: makeCtx(),
      substrings: ['yarn 4.14.0'],
    });
  });

  it('fix returns a note op', () => {
    expect.hasAssertions();
    const ops = yarnBinding.fix(makeCtx());
    const SINGLE = 1;
    expect(ops).toHaveLength(SINGLE);
    const [first] = ops;
    expect(first).toMatchObject({ op: 'note' });
  });
});
