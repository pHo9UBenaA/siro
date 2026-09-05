import {
  expectMessageContains,
  expectMessageContainsAndAvoids,
} from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/application/run-lint.ts';
import { minimumReleaseAge } from '../../../src/domain/rules/minimum-release-age.ts';

vi.setConfig({ testTimeout: 5000 });

describe('minimum-release-age (npm)', () => {
  const ctx = makeCtx();
  const { npm } = minimumReleaseAge.bindings;
  if (!npm) {
    throw new TypeError('expected npm binding');
  }

  it('is a warn-severity rule targeting .npmrc', () => {
    expect.hasAssertions();
    expect(minimumReleaseAge.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });
  });

  it('flags a violation when min-release-age is missing or not positive', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, {}).state).toBe('violation');
    expect(npm.check(ctx, { 'min-release-age': 0 }).state).toBe('violation');
  });

  it('passes when min-release-age is a positive number', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'min-release-age': 7 }).state).toBe('ok');
  });

  it.each(['0.5', '.5', '3.0', '3'])('accepts the positive release age %s from .npmrc', (value) => {
    expect.hasAssertions();
    const result = runLint({
      codecFor,
      ctx: makeCtx({
        readText: () => `min-release-age=${value}\n`,
      }),
      pms: ['npm'],
      ruleSet: [minimumReleaseAge],
    });
    expect(result.findings).toStrictEqual([]);
  });

  it.each(['0', '0.0', '-0.5', 'Infinity', '-Infinity', '1e309', 'NaN'])(
    'flags the inactive or invalid release age %s from .npmrc',
    (value) => {
      expect.hasAssertions();
      const result = runLint({
        codecFor,
        ctx: makeCtx({
          readText: () => `min-release-age=${value}\n`,
        }),
        pms: ['npm'],
        ruleSet: [minimumReleaseAge],
      });
      expect(result.findings.map((finding) => finding.ruleId)).toStrictEqual([
        'minimum-release-age',
      ]);
    },
  );

  it('fixes by setting a positive min-release-age', () => {
    expect.hasAssertions();
    const ops = npm.fix(ctx);
    const setKey = ops.find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['min-release-age'] });
    expect(setKey).toMatchObject({ value: expect.any(Number) });
  });
});

const { deno } = minimumReleaseAge.bindings;
if (!deno) {
  throw new TypeError('expected deno binding');
}

describe('minimum-release-age (deno)', () => {
  const ctx = makeCtx();

  it('targets deno.json', () => {
    expect.hasAssertions();
    expect(deno.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
  });

  it('passes when minimumDependencyAge is an ISO-8601 duration string', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 'P3D' }).state).toBe('ok');
  });

  it('accepts supported active strings and flags invalid strings', () => {
    expect.hasAssertions();
    const values = ['PT72H', '2026-09-04', '2026-09-04T12:34:56Z', '-P1D', 'not-a-duration'];
    expect(
      values.map((minimumDependencyAge) => deno.check(ctx, { minimumDependencyAge }).state),
    ).toStrictEqual(['ok', 'ok', 'ok', 'violation', 'violation']);
  });

  it('passes when minimumDependencyAge is a positive number (minutes)', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 4320 }).state).toBe('ok');
  });

  it('passes when minimumDependencyAge is an object with age property', () => {
    expect.hasAssertions();
    expect(
      deno.check(ctx, { minimumDependencyAge: { age: 'P3D', exclude: ['npm:foo'] } }).state,
    ).toBe('ok');
  });

  it('accepts a defaulted object without age and rejects arrays', () => {
    expect.hasAssertions();
    const values = [{ exclude: ['npm:foo'] }, []];
    expect(
      values.map((minimumDependencyAge) => deno.check(ctx, { minimumDependencyAge }).state),
    ).toStrictEqual(['ok', 'violation']);
  });

  it('flags zero-duration cooldowns in string and object forms', () => {
    expect.hasAssertions();
    const values = ['P0D', { age: 'P0D', exclude: ['npm:foo'] }];
    expect(
      values.map((minimumDependencyAge) => deno.check(ctx, { minimumDependencyAge }).state),
    ).toStrictEqual(['violation', 'violation']);
  });

  it('flags an equivalent zero-duration cooldown', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 'PT0S' }).state).toBe('violation');
  });

  it('flags an info advisory for the safe Deno default when minimumDependencyAge is unset', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, {})).toMatchObject({
      severity: 'info',
      state: 'violation',
    });
  });

  it('flags a violation when minimumDependencyAge is "0" (disabled)', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: '0' }).state).toBe('violation');
  });

  it('flags a violation when minimumDependencyAge is 0 (disabled)', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: 0 }).state).toBe('violation');
  });

  it('fix writes P3D as the recommended value', () => {
    expect.hasAssertions();
    const ops = deno.fix(ctx);
    const setKey = ops.find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['minimumDependencyAge'], value: 'P3D' });
  });
});

describe('minimum-release-age tells users which PM version made the key available or safe by default', () => {
  const ctx = makeCtx();

  it('on deno: tells the user from which Deno version the safe default applies', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: deno,
      ctx,
      substrings: ['default safe since deno 2.9.0'],
    });
  });

  it('on pnpm: tells the user from which pnpm version the safe default applies', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.pnpm,
      ctx,
      substrings: ['default safe since pnpm 11.0.0'],
    });
  });

  it('on npm: tells the user from which npm version the min-release-age key is available', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: minimumReleaseAge.bindings.npm,
      ctx,
      options: {
        contains: ['available since npm 11.10.0'],
        notMatching: [/npm >= 11\.10/u, /available since npm 11\.10(?!\.\d)/u],
      },
    });
  });

  it('on yarn: tells the user from which yarn version the safe default applies', () => {
    expect.hasAssertions();
    expectMessageContainsAndAvoids({
      binding: minimumReleaseAge.bindings.yarn,
      ctx,
      options: {
        contains: ['default safe since yarn 4.15.0'],
        notMatching: [/yarn 4\.15\+ defaults/u],
      },
    });
  });

  it('on pnpm: also tells the user from which pnpm version the key became available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.pnpm,
      ctx,
      substrings: ['available since pnpm 10.16.0'],
    });
  });

  it('on yarn: also tells the user from which yarn version the key became available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.yarn,
      ctx,
      substrings: ['available since yarn 4.10.0'],
    });
  });
});

describe('minimum-release-age minute strings (deno)', () => {
  it('accepts a positive minute string in deno.json', () => {
    expect.hasAssertions();
    expect(deno.check(makeCtx(), { minimumDependencyAge: '120' }).state).toBe('ok');
  });
});
