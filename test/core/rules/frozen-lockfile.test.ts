import assert from 'node:assert';
import { makeCtx, makePublishableCtx } from '../../helpers/ctx.ts';
import { manualSteps, automaticOperations } from '../../helpers/remediation.ts';
import { type ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { frozenLockfile } from '../../../src/core/rules/frozen-lockfile.ts';
import { bindingForTest } from '../../helpers/rules.ts';

describe('aube policy', () => {
  const ctx = makePublishableCtx;

  describe('frozen-lockfile', () => {
    it.each<ParsedConfig>([{}, { preferFrozenLockfile: false }, { preferFrozenLockfile: true }])(
      'advises command-level enforcement regardless of the lockfile preference: %j',
      (config) => {
        const ruleBinding = bindingForTest(frozenLockfile, 'aube');

        expect(ruleBinding.severity).toBe('info');
        expect(ruleBinding.check(ctx(), config)).toMatchObject({
          state: 'violation',
          remediation: {
            kind: 'manual',
            steps: [expect.stringMatching(/aube ci.*aube install --frozen-lockfile/u)],
          },
        });
      },
    );
  });
});

describe('bun policy', () => {
  const ctx = makePublishableCtx;

  describe('frozen-lockfile', () => {
    it('frozen-lockfile requires install.frozenLockfile=true (not install.frozen)', () => {
      const ruleBinding = bindingForTest(frozenLockfile, 'bun');

      expect(ruleBinding.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
      expect(ruleBinding.check(ctx(), { install: { frozen: true } }).state).toBe('violation');
      expect(ruleBinding.check(ctx(), { install: { frozenLockfile: true } }).state).toBe('ok');
      const missing = ruleBinding.check(ctx(), {});
      assert(missing.state === 'violation');
      expect(missing.severity).toBeUndefined();
      expect(frozenLockfile.severity).toBe('warn');
      expect(Object.keys(frozenLockfile.bindings).sort()).toEqual([
        'aube',
        'bun',
        'deno',
        'pnpm',
        'yarn',
      ]);
      const setKey = automaticOperations(missing)[0];
      assert(setKey, 'expected setKey op');
      expect(setKey).toMatchObject({ keyPath: ['install', 'frozenLockfile'], value: true });
    });
  });
});

describe('deno bindings target deno.json', () => {
  const ctx = makeCtx();
  it.each([{}, { lock: {} }])(
    'frozen-lockfile requires lock.frozen=true and fixes %j',
    (config) => {
      const ruleBinding = bindingForTest(frozenLockfile, 'deno');

      expect(ruleBinding.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
      const result = ruleBinding.check(ctx, config);
      expect(result.state).toBe('violation');
      assert(result.state === 'violation');
      expect(result.severity).toBeUndefined();
      expect(ruleBinding.check(ctx, { lock: { frozen: true } }).state).toBe('ok');
      expect(automaticOperations(result)[0]).toMatchObject({
        keyPath: ['lock', 'frozen'],
        value: true,
      });
    },
  );
  it('frozen-lockfile flags a string lock as manual (will not clobber it)', () => {
    const ruleBinding = bindingForTest(frozenLockfile, 'deno');

    const res = ruleBinding.check(ctx, { lock: 'custom.lock' });
    expect(res).toMatchObject({ state: 'violation' });
    assert(res.state === 'violation', 'expected violation');
    expect(manualSteps(res).length).toBeGreaterThan(0);
  });
});
