import assert from 'node:assert';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations, manualSteps } from '../../helpers/remediation.ts';

describe('deno bindings target deno.json', () => {
  const ctx = makeCtx();
  it.each([{}, { lock: {} }])(
    'frozen-lockfile requires lock.frozen=true and fixes %j',
    (config) => {
      expect.hasAssertions();
      const bd = frozenLockfile.bindings.deno;
      assert(bd, 'expected binding');
      expect(bd.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
      const result = bd.check(ctx, config);
      expect(result.state).toBe('violation');
      assert(result.state === 'violation');
      expect(result.severity).toBeUndefined();
      expect(bd.check(ctx, { lock: { frozen: true } }).state).toBe('ok');
      expect(automaticOperations(result).find((op) => op.op === 'setKey')).toMatchObject({
        keyPath: ['lock', 'frozen'],
        value: true,
      });
    },
  );

  it('frozen-lockfile flags a string lock as manual (will not clobber it)', () => {
    expect.hasAssertions();
    const bd = frozenLockfile.bindings.deno;
    assert(bd, 'expected binding');
    const res = bd.check(ctx, { lock: 'custom.lock' });
    expect(res).toMatchObject({ state: 'violation' });
    assert(res.state === 'violation', 'expected violation');
    assert(manualSteps(res), 'expected manualSteps');
    expect(manualSteps(res)!.length).toBeGreaterThan(0);
  });
});

describe('pin-exact-versions × deno — ok: simple cases', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('ok when no imports key is present', () => {
    expect.hasAssertions();
    expect(bd.check(ctx, {}).state).toBe('ok');
  });

  it('ok when all jsr/npm imports are exact', () => {
    expect.hasAssertions();
    const config = {
      imports: {
        '@std/path': 'jsr:@std/path@1.0.0',
        react: 'npm:react@18.2.0',
      },
    };
    expect(bd.check(ctx, config).state).toBe('ok');
  });

  it('leaves URLs, relative paths and bare aliases outside the registry policy', () => {
    expect.hasAssertions();
    const config = {
      imports: {
        std: 'https://deno.land/std@0.211.0/path/mod.ts',
        relative: './local/path.ts',
        alias: '@std/path',
      },
    };
    expect(bd.check(ctx, config).state).toBe('ok');
  });
});

describe('pin-exact-versions × deno — single-specifier violations', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('reports unpinned npm and jsr imports with manual guidance', () => {
    expect.hasAssertions();
    const config = { imports: { '@std/path': 'jsr:@std/path@^1.0.0', react: 'npm:react@^18.2.0' } };
    const result = bd.check(ctx, config);
    expect(bd.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
    expect(manualSteps(result)).toEqual(
      expect.arrayContaining([expect.stringContaining('deno add --save-exact')]),
    );
    expect(result).toMatchObject({
      message: expect.stringMatching(/@std\/path.*react/u),
      state: 'violation',
    });
  });
});

describe('pin-exact-versions × deno — aggregation and truncation', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('reports the total and truncates the sample when more than 3 imports are unpinned', () => {
    expect.hasAssertions();
    const config = {
      imports: {
        pkgA: 'jsr:@x/a@^1',
        pkgB: 'jsr:@x/b@^1',
        pkgC: 'jsr:@x/c@^1',
        pkgD: 'jsr:@x/d@^1',
        pkgE: 'jsr:@x/e@^1',
      },
    };
    expect(bd.check(ctx, config)).toMatchObject({
      message: expect.stringMatching(/5 deno imports are not pinned.*and 2 more/u),
      state: 'violation',
    });
  });
});
