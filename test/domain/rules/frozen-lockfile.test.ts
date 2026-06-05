import assert from 'node:assert';
import { expectDocumentedDefaultDynamicInfo } from '../../helpers/binding-expectations.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import type { PM } from '../../../src/domain/entities/pms.ts';

vi.setConfig({ testTimeout: 5000 });

describe('frozen-lockfile rule identity', () => {
  it('ships at warn severity', () => {
    expect.hasAssertions();
    expect(frozenLockfile.severity).toBe('warn');
  });

  it('does not apply to npm (the equivalent is the `npm ci` command, not a config flag)', () => {
    expect.hasAssertions();
    expect(frozenLockfile.bindings.npm).toBeUndefined();
  });

  it.each<PM>(['pnpm', 'yarn', 'bun', 'deno', 'aube'])('applies to %s', (pm) => {
    expect.hasAssertions();
    expect(frozenLockfile.bindings[pm]).toBeDefined();
  });

  it.each<PM>(['pnpm', 'yarn', 'aube'])(
    'on %s: unset → dynamic info via documentedDefault',
    (pm) => {
      expect.hasAssertions();
      // pnpm, yarn (CI default), and aube all document the safe default,
      // so an unset key is advisory rather than warn.
      expectDocumentedDefaultDynamicInfo(frozenLockfile.bindings[pm], makeCtx());
    },
  );

  it.each<PM>(['bun', 'deno'])(
    'on %s: unset → plain violation (no documentedDefault downgrade)',
    (pm) => {
      expect.hasAssertions();
      // Neither bun nor deno document a built-in safe default, so unset must
      // surface as a real violation — a regression to D-2 would silently
      // weaken these PMs.
      const bd = frozenLockfile.bindings[pm];
      assert(bd, `expected ${pm} binding`);
      const status = bd.check(makeCtx(), {});
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );

  it('on bun: pins install.frozenLockfile (not install.frozen) so the rule does not silently no-op', () => {
    expect.hasAssertions();
    // The bun docs name the key `install.frozenLockfile`; a previous rev of
    // this rule shipped `install.frozen` which would silently never fire.
    // Pin via the fix op's keyPath so a builder refactor that drops the key
    // entirely (e.g. a rename gone wrong) fails this test.
    const bunBinding = frozenLockfile.bindings.bun;
    assert(bunBinding, 'expected bun binding');
    const setKey = bunBinding.fix(makeCtx()).find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['install', 'frozenLockfile'], value: true });
  });
});
