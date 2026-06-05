const FIRST_ELEMENT = 0;
import { makeCtx, makePublishableCtx } from '../../helpers/ctx.ts';
import type { PM } from '../../../src/domain/entities/pms.ts';
import type { RepoContext } from '../../../src/domain/ports/repo-context.ts';
import { commitLockfile } from '../../../src/domain/rules/commit-lockfile.ts';
import assert from 'node:assert';

vi.setConfig({ testTimeout: 5000 });

const ctxWith = (files: readonly string[]): RepoContext => makeCtx({ files });

describe('commit-lockfile (npm)', () => {
  const npmBinding = commitLockfile.bindings.npm;
  assert(npmBinding, 'expected npm binding');

  it('is an error-severity rule', () => {
    expect.hasAssertions();
    expect(commitLockfile.severity).toBe('error');
  });

  it('flags a violation when no lockfile is present', () => {
    expect.hasAssertions();
    expect(npmBinding.check(ctxWith([]), {}).state).toBe('violation');
  });

  it('passes when package-lock.json exists', () => {
    expect.hasAssertions();
    expect(npmBinding.check(ctxWith(['package-lock.json']), {}).state).toBe('ok');
  });

  it('passes when npm-shrinkwrap.json exists', () => {
    expect.hasAssertions();
    expect(npmBinding.check(ctxWith(['npm-shrinkwrap.json']), {}).state).toBe('ok');
  });

  it('fix is advisory (ensureFileTracked), not auto-writable', () => {
    expect.hasAssertions();
    const ops = npmBinding.fix(ctxWith([]));
    expect(ops.every((op) => op.op !== 'setKey')).toBe(true);
    const firstOp = ops[FIRST_ELEMENT];
    assert(firstOp, 'expected at least one fix op');
    expect(firstOp.op).toBe('ensureFileTracked');
  });
});

// Per-PM lockfile detection lives on commit-lockfile, not the PM binding files
// — the rule decides which lockfile to look for given a PM, so the assertion
// belongs next to the rule. The table also makes it impossible to add a new
// PM and silently forget to wire the lockfile name through.
const LOCKFILE_BY_PM: readonly { pm: PM; lockfile: string }[] = [
  { lockfile: 'pnpm-lock.yaml', pm: 'pnpm' },
  { lockfile: 'yarn.lock', pm: 'yarn' },
  { lockfile: 'bun.lock', pm: 'bun' },
  { lockfile: 'deno.lock', pm: 'deno' },
  { lockfile: 'aube-lock.yaml', pm: 'aube' },
];

describe('commit-lockfile per-PM lockfile detection', () => {
  it.each(LOCKFILE_BY_PM)(
    '$pm: ok when $lockfile exists, violation when absent',
    ({ pm, lockfile }) => {
      expect.hasAssertions();
      const bd = commitLockfile.bindings[pm];
      assert(bd, `expected ${pm} binding`);
      expect(bd.check(makePublishableCtx({ exists: (fp) => fp === lockfile }), {}).state).toBe(
        'ok',
      );
      expect(bd.check(makePublishableCtx({ exists: () => false }), {}).state).toBe('violation');
    },
  );

  it('aube is satisfied by a reused lockfile shape (e.g. bun.lockb)', () => {
    expect.hasAssertions();
    // aube writes aube-lock.yaml but reuses any pre-existing lockfile; a repo
    // migrating from bun keeps its bun.lockb, and that should satisfy the rule.
    const aubeBinding = commitLockfile.bindings.aube;
    assert(aubeBinding, 'expected aube binding');
    expect(
      aubeBinding.check(makePublishableCtx({ exists: (fp) => fp === 'bun.lockb' }), {}).state,
    ).toBe('ok');
  });
});
