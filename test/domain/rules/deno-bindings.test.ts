import assert from 'node:assert';
import { filesField } from '../../../src/domain/rules/files-field.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { pinExactVersions } from '../../../src/domain/rules/pin-exact-versions.ts';

vi.setConfig({ testTimeout: 5000 });

const EMPTY = 0;
const FIRST_ELEMENT = 0;

describe('deno bindings target deno.json', () => {
  const ctx = makeCtx();
  it('frozen-lockfile requires lock.frozen=true and fixes it', () => {
    expect.hasAssertions();
    const bd = frozenLockfile.bindings.deno;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
    expect(bd.check(ctx, {}).state).toBe('violation');
    expect(bd.check(ctx, { lock: { frozen: true } }).state).toBe('ok');
    expect(bd.fix(ctx).find((op) => op.op === 'setKey')).toMatchObject({
      keyPath: ['lock', 'frozen'],
      value: true,
    });
  });
  it('frozen-lockfile auto-fixes when lock is absent or already a mapping', () => {
    expect.hasAssertions();
    const bd = frozenLockfile.bindings.deno;
    assert(bd, 'expected binding');
    const absent = bd.check(ctx, {});
    const mapping = bd.check(ctx, { lock: {} });
    assert(absent.state === 'violation', 'expected violation');
    assert(mapping.state === 'violation', 'expected violation');
    expect(absent.manualSteps).toBeUndefined();
    expect(mapping.manualSteps).toBeUndefined();
  });
  it('frozen-lockfile flags a string lock as manual (will not clobber it)', () => {
    expect.hasAssertions();
    const bd = frozenLockfile.bindings.deno;
    assert(bd, 'expected binding');
    const res = bd.check(ctx, { lock: 'custom.lock' });
    expect(res).toMatchObject({ state: 'violation' });
    assert(res.state === 'violation', 'expected violation');
    assert(res.manualSteps, 'expected manualSteps');
    expect(res.manualSteps.length).toBeGreaterThan(EMPTY);
  });
  it('frozen-lockfile flags a false lock as manual (will not clobber it)', () => {
    expect.hasAssertions();
    const bd = frozenLockfile.bindings.deno;
    assert(bd, 'expected binding');
    const res = bd.check(ctx, { lock: false });
    expect(res).toMatchObject({ state: 'violation' });
    assert(res.state === 'violation', 'expected violation');
    assert(res.manualSteps, 'expected manualSteps');
    expect(res.manualSteps.length).toBeGreaterThan(EMPTY);
  });
  it('files-field uses deno.json publish.include for publishable repos', () => {
    expect.hasAssertions();
    const bd = filesField.bindings.deno;
    assert(bd, 'expected binding');
    expect(bd.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
    expect(bd.check(ctx, { name: '@scope/pkg' }).state).toBe('violation');
    expect(bd.check(ctx, { name: '@scope/pkg', publish: { include: ['mod.ts'] } }).state).toBe(
      'ok',
    );
  });
});

describe('pin-exact-versions × deno — binding shape', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('binds to deno.json as an advisory binding', () => {
    expect.hasAssertions();
    expect(bd.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
    expect(bd.fixKind).toBe('advisory');
  });

  it('fix returns an advisory note (manual remediation)', () => {
    expect.hasAssertions();
    const ops = bd.fix(ctx);
    expect(ops.length).toBeGreaterThan(EMPTY);
    const firstOp = ops[FIRST_ELEMENT];
    assert(firstOp, 'expected first op');
    expect(firstOp.op).toBe('note');
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

  it('ok when imports is empty', () => {
    expect.hasAssertions();
    expect(bd.check(ctx, { imports: {} }).state).toBe('ok');
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

  it('ignores URL specifiers (no version-range concept)', () => {
    expect.hasAssertions();
    const config = {
      imports: {
        std: 'https://deno.land/std@0.211.0/path/mod.ts',
      },
    };
    expect(bd.check(ctx, config).state).toBe('ok');
  });
});

describe('pin-exact-versions × deno — ok: boundary cases', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('treats specifiers without explicit version as no-range (current behaviour)', () => {
    expect.hasAssertions();
    const config = {
      imports: {
        'bare-prefix': '@std/path',
        'no-version-jsr': 'jsr:@scope/pkg',
        'no-version-npm': 'npm:react',
        relative: './local/path.ts',
      },
    };
    expect(bd.check(ctx, config).state).toBe('ok');
  });

  it('treats an x inside a prerelease tag as exact (1.0.0-x.1)', () => {
    expect.hasAssertions();
    const status = bd.check(ctx, {
      imports: { foo: 'npm:foo@1.0.0-x.1' },
    });
    expect(status).toMatchObject({ state: 'ok' });
  });
});

describe('pin-exact-versions × deno — single-specifier violations', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('violation when any jsr import uses a caret range', () => {
    expect.hasAssertions();
    const config = { imports: { '@std/path': 'jsr:@std/path@^1.0.0' } };
    expect(bd.check(ctx, config)).toMatchObject({
      message: expect.stringContaining('@std/path'),
      state: 'violation',
    });
  });

  it('violation when an npm import uses a caret range', () => {
    expect.hasAssertions();
    const config = { imports: { react: 'npm:react@^18.2.0' } };
    const res = bd.check(ctx, config);
    expect(res.state).toBe('violation');
  });

  it('flags wildcard-segment specifiers (1.x / 1.* / 1.0.x) as ranges', () => {
    expect.hasAssertions();
    const status = bd.check(ctx, {
      imports: { bar: 'npm:bar@1.*', baz: 'npm:baz@1.0.x', foo: 'npm:foo@1.x' },
    });
    expect(status).toMatchObject({ state: 'violation' });
  });
});

describe('pin-exact-versions × deno — aggregation and truncation', () => {
  const ctx = makeCtx();
  const bd = pinExactVersions.bindings.deno;
  assert(bd, 'expected binding');

  it('aggregates multiple offenders with count + sample', () => {
    expect.hasAssertions();
    const config = {
      imports: {
        pkgA: 'jsr:@x/a@^1.0.0',
        pkgB: 'jsr:@x/b@~2.0.0',
        pkgC: 'jsr:@x/c@>=3',
        pkgD: 'jsr:@x/d@*',
      },
    };
    expect(bd.check(ctx, config)).toMatchObject({
      message: expect.stringMatching(/4 deno imports use semver ranges/u),
      state: 'violation',
    });
  });

  it('truncates sample when more than 3 offenders', () => {
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
      message: expect.stringMatching(/and 2 more/u),
      state: 'violation',
    });
  });
});
