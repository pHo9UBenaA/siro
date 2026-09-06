import { automaticOperations } from '../../helpers/remediation.ts';
import {
  expectMessageContains,
  expectMessageContainsAndAvoids,
} from '../../helpers/binding-expectations.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/application/run-lint.ts';
import { minimumReleaseAge } from '../../../src/domain/rules/minimum-release-age.ts';

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

  it.each(['0', '0.0', '-0.5', 'Infinity', '-Infinity', '1e300', '1e309', '1e-300', 'NaN'])(
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

  it.each([
    { before: '2020-01-01', state: 'ok' },
    { before: 'Wed, 01 Jan 2020 00:00:00 GMT', state: 'ok' },
    { before: '2026-09-06T11:59:59.999Z', state: 'ok' },
    { before: '2026-09-06T12:00:00.000Z', state: 'violation' },
    { before: '2999-01-01', state: 'violation' },
    { before: 'null', state: 'violation' },
    { before: 'false', state: 'violation' },
    { before: 'true', state: 'violation' },
    { before: '', state: 'violation' },
    { before: 'invalid', state: 'violation' },
    { before: '0', state: 'ok' },
  ])('checks the before cutoff $before independently of min-release-age', ({ before, state }) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T12:00:00.000Z'));
    try {
      const codec = codecFor('npmrc');
      for (const age of ['', 'min-release-age=0\n', 'min-release-age=3\n']) {
        const config = codec.parse(`${age}before=${before}\n`);
        const result = npm.check(ctx, config);
        expect(result.state).toBe(state);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    'before=2999-01-01',
    'before=null',
    'before=false',
    'before=invalid',
    'before[]=2020-01-01',
  ])('requires manual review of %s', (setting) => {
    const result = npm.check(ctx, codecFor('npmrc').parse(`${setting}\nmin-release-age=3`));
    expect(result).toMatchObject({
      state: 'violation',
      remediation: { kind: 'manual', steps: [expect.stringContaining('before')] },
    });
  });

  it('fixes by setting a positive min-release-age', () => {
    expect.hasAssertions();
    const ops = automaticOperations(npm.check(ctx, {}));
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

  it('passes an object setting without an age', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: { exclude: ['npm:foo'] } }).state).toBe('ok');
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

  it('keeps full severity when the Deno version-dependent default is unverified', () => {
    expect.hasAssertions();
    const status = deno.check(ctx, {});
    expect(status).toMatchObject({ state: 'violation' });
    assert(status.state === 'violation');
    expect(status.severity).toBeUndefined();
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
    const ops = automaticOperations(deno.check(ctx, {}));
    const setKey = ops.find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['minimumDependencyAge'], value: 'P3D' });
  });
});

describe('minimum-release-age tells users which PM version made the key available or safe by default', () => {
  const ctx = makeCtx();

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

  it('on deno: tells the user when the safe default became available', () => {
    expect.hasAssertions();
    expectMessageContains({
      binding: minimumReleaseAge.bindings.deno,
      ctx,
      substrings: ['default safe since deno 2.9.0'],
    });
  });
});

describe('minimum-release-age minute strings (deno)', () => {
  it('accepts a positive minute string in deno.json', () => {
    expect.hasAssertions();
    expect(deno.check(makeCtx(), { minimumDependencyAge: '120' }).state).toBe('ok');
  });
});

describe('Deno release-age formats from the official parser', () => {
  it.each([
    '2020-01-01T12:30Z',
    'P1Y',
    'P1M',
    'P1WT1H',
    'P1.5D',
    'PT1.5H',
    'PT1.5M',
    'PT1,5S',
    'P1000000000D',
    'PT0.0000000001S',
    0.5,
    1e15,
    { age: 'P3D', typo: true },
  ])('rejects unsupported input %j', (value) => {
    expect(deno.check(makeCtx(), { minimumDependencyAge: value }).state).toBe('violation');
  });

  it.each([
    '2016-12-31T23:59:60Z',
    { age: null },
    '+P3D',
    'P2w',
    'PT1.5s',
    'P1DT2h',
    '2025-09-16T12:50+0900',
    '2025-09-16T12:50:10+0900',
  ])('accepts supported input %j', (value) => {
    expect(deno.check(makeCtx(), { minimumDependencyAge: value }).state).toBe('ok');
  });

  it('flags a cutoff that has not yet passed', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-06T00:00:00Z'));
      expect(deno.check(makeCtx(), { minimumDependencyAge: '2026-09-07' }).state).toBe('violation');
    } finally {
      vi.useRealTimers();
    }
  });
});
