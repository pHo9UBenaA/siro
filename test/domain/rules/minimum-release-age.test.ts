import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/application/run-lint.ts';
import { makeCtx } from '../../helpers/ctx.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { minimumReleaseAge } from '../../helpers/rules.ts';

describe('minimum-release-age (npm)', () => {
  const ctx = makeCtx();
  const { npm } = minimumReleaseAge.bindings;
  if (!npm) {
    throw new TypeError('expected npm binding');
  }

  it('requires a positive npm release age and proposes a three-day cooldown', () => {
    const status = npm.check(ctx, {});

    expect(status.state).toBe('violation');
    expect(npm.check(ctx, { 'min-release-age': 0 }).state).toBe('violation');

    expect(minimumReleaseAge.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });

    const ops = automaticOperations(status);
    expect(ops).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        op: 'setKey',
        keyPath: ['min-release-age'],
        value: 3,
      },
    ]);
  });

  it('passes when min-release-age is a positive number', () => {
    expect.hasAssertions();
    expect(npm.check(ctx, { 'min-release-age': 7 }).state).toBe('ok');
  });

  it.each(['.5', '3'])('accepts the positive release age %s from .npmrc', (value) => {
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

  it.each(['0', '-0.5', 'Infinity', '1e300', '1e309', '1e-300', 'NaN'])(
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
      const config = codec.parse(`min-release-age=3\nbefore=${before}\n`);
      const result = npm.check(ctx, config);
      const remediation = {
        kind: 'manual',
        steps: expect.arrayContaining([expect.stringContaining('before')]),
      };
      expect(result).toMatchObject(state === 'violation' ? { state, remediation } : { state });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['before[]=2020-01-01'])('requires manual review of %s', (setting) => {
    const result = npm.check(ctx, codecFor('npmrc').parse(`${setting}\nmin-release-age=3`));
    expect(result).toMatchObject({
      state: 'violation',
      remediation: {
        kind: 'manual',
        steps: expect.arrayContaining([expect.stringContaining('before')]),
      },
    });
  });
});

const { deno } = minimumReleaseAge.bindings;
if (!deno) {
  throw new TypeError('expected deno binding');
}

describe('minimum-release-age (deno)', () => {
  const ctx = makeCtx();

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

  it("honors Deno's project .npmrc release-age fallback", () => {
    const result = runLint({
      codecFor,
      ctx: makeCtx({
        readText: (file) => (file === '.npmrc' ? 'min-release-age=3\n' : undefined),
      }),
      pms: ['deno'],
      ruleSet: [minimumReleaseAge],
    });
    expect(result.findings).toStrictEqual([]);
  });

  it('keeps deno.json priority over the project .npmrc fallback', () => {
    const disabledFallback = makeCtx({
      readText: (file) => (file === '.npmrc' ? 'min-release-age=0\n' : undefined),
    });
    const activeFallback = makeCtx({
      readText: (file) => (file === '.npmrc' ? 'min-release-age=3\n' : undefined),
    });
    expect(deno.check(disabledFallback, { minimumDependencyAge: 'P3D' }).state).toBe('ok');
    expect(deno.check(activeFallback, { minimumDependencyAge: 0 }).state).toBe('violation');
  });

  it("flags Deno's explicit .npmrc release-age opt-out", () => {
    const result = runLint({
      codecFor,
      ctx: makeCtx({
        readText: (file) => (file === '.npmrc' ? 'min-release-age=0\n' : undefined),
      }),
      pms: ['deno'],
      ruleSet: [minimumReleaseAge],
    });
    expect(result.findings).toMatchObject([
      {
        file: '.npmrc',
        actual: 0,
        remediation: { kind: 'automatic', operations: [{ file: { path: '.npmrc' } }] },
      },
    ]);
  });

  it('passes when minimumDependencyAge is an object with age property', () => {
    expect.hasAssertions();
    expect(
      deno.check(ctx, { minimumDependencyAge: { age: 'P3D', exclude: ['npm:foo'] } }).state,
    ).toBe('ok');
  });

  it('preserves valid exclusions by targeting only age and rejects malformed exclusions', () => {
    expect(
      automaticOperations(
        deno.check(ctx, {
          minimumDependencyAge: { age: 'P0D', exclude: ['reviewed-package'] },
        }),
      ),
    ).toEqual([
      expect.objectContaining({ keyPath: ['minimumDependencyAge', 'age'], value: 'P3D' }),
    ]);
    expect(deno.check(ctx, { minimumDependencyAge: { age: 'P0D', exclude: false } })).toMatchObject(
      { remediation: { kind: 'manual' }, state: 'violation' },
    );
  });

  it('passes an object setting without an age', () => {
    expect.hasAssertions();
    expect(deno.check(ctx, { minimumDependencyAge: { exclude: ['npm:foo'] } }).state).toBe('ok');
  });

  it('flags zero-duration cooldowns in string and numeric forms', () => {
    expect.hasAssertions();
    const values = ['P0D', 0];
    expect(
      values.map((minimumDependencyAge) => deno.check(ctx, { minimumDependencyAge }).state),
    ).toStrictEqual(['violation', 'violation']);
  });

  it('proposes a three-day cooldown in deno.json', () => {
    const ops = automaticOperations(deno.check(ctx, {}));
    const setKey = ops.find((op) => op.op === 'setKey');
    expect(setKey).toMatchObject({ keyPath: ['minimumDependencyAge'], value: 'P3D' });

    expect(deno.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
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
