import { makeCtx, makePublishableCtx } from '../../helpers/ctx.ts';
import { manualSteps, automaticOperations } from '../../helpers/remediation.ts';
import { type ParsedConfig } from '../../../src/core/contracts/config-value.ts';
import { frozenLockfile } from '../../../src/core/rules/frozen-lockfile.ts';
import { assertCheckState, bindingForTest } from '../../helpers/rules.ts';

describe('frozen-lockfile (aube)', () => {
  const ctx = makePublishableCtx;

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

describe('frozen-lockfile (bun)', () => {
  const ctx = makePublishableCtx;

  it('frozen-lockfile requires install.frozenLockfile=true (not install.frozen)', () => {
    const ruleBinding = bindingForTest(frozenLockfile, 'bun');

    expect(ruleBinding.file).toStrictEqual({ kind: 'toml', path: 'bunfig.toml' });
    expect(ruleBinding.check(ctx(), { install: { frozen: true } }).state).toBe('violation');
    expect(ruleBinding.check(ctx(), { install: { frozenLockfile: true } }).state).toBe('ok');
    const missing = ruleBinding.check(ctx(), {});
    assertCheckState(missing, 'violation');
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
    expect(setKey).toMatchObject({ keyPath: ['install', 'frozenLockfile'], value: true });
  });
});

describe('deno bindings target deno.json', () => {
  const ctx = makeCtx();

  it.each([{}, { lock: {} }])(
    'requires lock.frozen=true and proposes a scalar write for %j',
    (config) => {
      const ruleBinding = bindingForTest(frozenLockfile, 'deno');

      expect(ruleBinding.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
      const result = ruleBinding.check(ctx, config);
      assertCheckState(result, 'violation');
      expect(result.severity).toBeUndefined();
      expect(ruleBinding.check(ctx, { lock: { frozen: true } }).state).toBe('ok');
      expect(automaticOperations(result)[0]).toMatchObject({
        keyPath: ['lock', 'frozen'],
        value: true,
      });
    },
  );

  it('requires manual review instead of overwriting a string lockfile path', () => {
    const ruleBinding = bindingForTest(frozenLockfile, 'deno');

    const status = ruleBinding.check(ctx, { lock: 'custom.lock' });
    expect(status).toMatchObject({ state: 'violation' });
    expect(manualSteps(status).length).toBeGreaterThan(0);
  });
});
