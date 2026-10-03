import { asAbsPath, lint, type LintOptions } from '../../../src/index.ts';
import { createMemFileSystem } from '../../helpers/memfs.ts';
import { makePublishableCtx, makeCtx } from '../../helpers/ctx.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../../src/core/parse-config-file.ts';
import { automaticOperations } from '../../helpers/remediation.ts';
import { bindingForTest, minimumReleaseAge } from '../../helpers/rules.ts';
import { createMinimumReleaseAge } from '../../../src/core/rules/minimum-release-age.ts';

describe('minimum-release-age (npm)', () => {
  const ctx = makeCtx();
  const npm = bindingForTest(minimumReleaseAge, 'npm');

  it('requires a positive npm release age and proposes a three-day cooldown', () => {
    const status = npm.check(ctx, {});

    expect(status.state).toBe('violation');
    expect(npm.check(ctx, { 'min-release-age': 0 }).state).toBe('violation');

    expect(minimumReleaseAge.severity).toBe('warn');
    expect(npm.file).toStrictEqual({ kind: 'npmrc', path: '.npmrc' });

    const operations = automaticOperations(status);
    expect(operations).toStrictEqual([
      {
        file: { kind: 'npmrc', path: '.npmrc' },
        op: 'setKey',
        keyPath: ['min-release-age'],
        value: 3,
      },
    ]);
  });

  it('passes when min-release-age is a positive number', () => {
    expect(npm.check(ctx, { 'min-release-age': 7 }).state).toBe('ok');
  });

  it.each(['.5', '3'])('accepts the positive release age %s from .npmrc', (value) => {
    const result = runLint({
      repository: createRepositoryEvaluation(
        makeCtx({
          readText: () => `min-release-age=${value}\n`,
        }),
        codecFor,
      ),
      targets: [{ pm: 'npm' }],
      ruleSet: [minimumReleaseAge],
    });
    expect(result.findings).toStrictEqual([]);
  });

  it.each(['0', '-0.5', 'Infinity', '1e300', '1e309', '1e-300', 'NaN'])(
    'flags the inactive or invalid release age %s from .npmrc',
    (value) => {
      const result = runLint({
        repository: createRepositoryEvaluation(
          makeCtx({
            readText: () => `min-release-age=${value}\n`,
          }),
          codecFor,
        ),
        targets: [{ pm: 'npm' }],
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
    const rule = createMinimumReleaseAge({
      now: () => Date.parse('2026-09-06T12:00:00.000Z'),
      parse: Date.parse,
    });
    const config = codecFor('npmrc').parse(`min-release-age=3\nbefore=${before}\n`);
    const result = bindingForTest(rule, 'npm').check(ctx, config);
    const expectedRemediation = {
      kind: 'manual',
      steps: expect.arrayContaining([expect.stringContaining('before')]),
    };
    const expected =
      state === 'violation' ? { state, remediation: expectedRemediation } : { state };
    expect(result).toMatchObject(expected);
  });

  it('requires manual review of a before array', () => {
    const result = npm.check(
      ctx,
      codecFor('npmrc').parse('before[]=2020-01-01\nmin-release-age=3'),
    );
    expect(result).toMatchObject({
      state: 'violation',
      remediation: {
        kind: 'manual',
        steps: expect.arrayContaining([expect.stringContaining('before')]),
      },
    });
  });
});

const deno = bindingForTest(minimumReleaseAge, 'deno');

describe('minimum-release-age (deno)', () => {
  const ctx = makeCtx();

  it('passes when minimumDependencyAge is an ISO-8601 duration string', () => {
    expect(deno.check(ctx, { minimumDependencyAge: 'P3D' }).state).toBe('ok');
  });

  it.each([
    { minimumDependencyAge: 'PT72H', state: 'ok' },
    { minimumDependencyAge: '2026-09-04', state: 'ok' },
    { minimumDependencyAge: '2026-09-04T12:34:56Z', state: 'ok' },
    { minimumDependencyAge: '-P1D', state: 'violation' },
    { minimumDependencyAge: 'not-a-duration', state: 'violation' },
  ])('classifies Deno age $minimumDependencyAge as $state', ({ minimumDependencyAge, state }) => {
    expect(deno.check(ctx, { minimumDependencyAge }).state).toBe(state);
  });

  it('passes when minimumDependencyAge is a positive number (minutes)', () => {
    expect(deno.check(ctx, { minimumDependencyAge: 4320 }).state).toBe('ok');
  });

  it("honors Deno's project .npmrc release-age fallback", () => {
    const result = runLint({
      repository: createRepositoryEvaluation(
        makeCtx({
          readText: (file) => (file === '.npmrc' ? 'min-release-age=3\n' : undefined),
        }),
        codecFor,
      ),
      targets: [{ pm: 'deno' }],
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
      repository: createRepositoryEvaluation(
        makeCtx({
          readText: (file) => (file === '.npmrc' ? 'min-release-age=0\n' : undefined),
        }),
        codecFor,
      ),
      targets: [{ pm: 'deno' }],
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

  it.each([undefined, null, {}, { age: null }, { exclude: ['npm:foo'] }])(
    'requires an active fallback for %j',
    (value) => {
      expect(deno.check(ctx, { minimumDependencyAge: value }).state).toBe('violation');
      const fallback = makeCtx({
        readText: (file) => (file === '.npmrc' ? 'min-release-age=3\n' : undefined),
      });
      expect(deno.check(fallback, { minimumDependencyAge: value }).state).toBe('ok');
    },
  );

  it.each(['P0D', 0])('flags zero-duration Deno age %s', (minimumDependencyAge) => {
    expect(deno.check(ctx, { minimumDependencyAge }).state).toBe('violation');
  });

  it('proposes a three-day cooldown in deno.json', () => {
    const [setKey] = automaticOperations(deno.check(ctx, {}));
    expect(setKey).toMatchObject({ keyPath: ['minimumDependencyAge'], value: 'P3D' });

    expect(deno.file).toStrictEqual({ kind: 'json', path: 'deno.json' });
  });
});

describe('minimum-release-age minute strings (deno)', () => {
  it('accepts a positive minute string in deno.json', () => {
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
    const rule = createMinimumReleaseAge({
      now: () => Date.parse('2026-09-06T00:00:00Z'),
      parse: Date.parse,
    });
    expect(
      bindingForTest(rule, 'deno').check(makeCtx(), { minimumDependencyAge: '2026-09-07' }).state,
    ).toBe('violation');
  });
});

describe('minimum-release-age (aube)', () => {
  it('reports the Aube default as info and proposes an explicit three-day cooldown', () => {
    const ruleBinding = bindingForTest(minimumReleaseAge, 'aube');

    expect(ruleBinding.file).toStrictEqual({ kind: 'yaml', path: 'aube-workspace.yaml' });
    const status = ruleBinding.check(makePublishableCtx(), {});
    expect(status).toMatchObject({ state: 'violation', severity: 'info' });
    const regression = ruleBinding.check(makePublishableCtx(), { minimumReleaseAge: 0 });
    expect(regression).toMatchObject({ state: 'violation' });
    expect(regression).not.toHaveProperty('severity');
    expect(ruleBinding.check(makePublishableCtx(), { minimumReleaseAge: 1440 }).state).toBe('ok');

    const setKey = automaticOperations(status)[0];
    expect(setKey).toMatchObject({
      keyPath: ['minimumReleaseAge'],
      value: 4320,
    });
  });
});

describe('minimum-release-age (bun)', () => {
  it('minimum-release-age writes install.minimumReleaseAge (3 days in seconds)', () => {
    const ruleBinding = bindingForTest(minimumReleaseAge, 'bun');

    expect(
      ruleBinding.check(makePublishableCtx(), { install: { minimumReleaseAge: 259200 } }).state,
    ).toBe('ok');
    const setKey = automaticOperations(ruleBinding.check(makePublishableCtx(), {}))[0];
    expect(setKey).toMatchObject({
      keyPath: ['install', 'minimumReleaseAge'],
      value: 259200,
    });
  });
});

describe('minimum-release-age (pnpm)', () => {
  it('checks minimumReleaseAge (3 days in minutes)', () => {
    const ruleBinding = bindingForTest(minimumReleaseAge, 'pnpm');

    expect(ruleBinding.check(makePublishableCtx(), {}).state).toBe('violation');
    expect(ruleBinding.check(makePublishableCtx(), { minimumReleaseAge: 1440 }).state).toBe('ok');
    const setKey = automaticOperations(ruleBinding.check(makePublishableCtx(), {}))[0];
    expect(setKey).toMatchObject({
      keyPath: ['minimumReleaseAge'],
      value: 4320,
    });
  });
});

describe('minimum-release-age (yarn)', () => {
  it.each([
    { npmMinimalAgeGate: '1w', state: 'ok' },
    { npmMinimalAgeGate: '1d', state: 'ok' },
    { npmMinimalAgeGate: '1.5h', state: 'ok' },
    { npmMinimalAgeGate: '.5m', state: 'ok' },
    { npmMinimalAgeGate: '120', state: 'ok' },
    { npmMinimalAgeGate: '1ms', state: 'ok' },
    { npmMinimalAgeGate: '0m', state: 'violation' },
    { npmMinimalAgeGate: '0', state: 'violation' },
    { npmMinimalAgeGate: '-1d', state: 'violation' },
    { npmMinimalAgeGate: '1y', state: 'violation' },
    { npmMinimalAgeGate: '1d junk', state: 'violation' },
  ])('classifies Yarn age $npmMinimalAgeGate as $state', ({ npmMinimalAgeGate, state }) => {
    const ruleBinding = bindingForTest(minimumReleaseAge, 'yarn');
    expect(ruleBinding.check(makePublishableCtx(), { npmMinimalAgeGate }).state).toBe(state);
  });

  it('checks npmMinimalAgeGate', () => {
    const ruleBinding = bindingForTest(minimumReleaseAge, 'yarn');

    expect(ruleBinding.check(makePublishableCtx(), { npmMinimalAgeGate: 1440 }).state).toBe('ok');
    const setKey = automaticOperations(ruleBinding.check(makePublishableCtx(), {}))[0];
    expect(setKey).toMatchObject({
      keyPath: ['npmMinimalAgeGate'],
      value: 4320,
    });
  });
});

describe('Deno .npmrc days and deno.json minutes', () => {
  const inspect = (files: Record<string, string>, options: Partial<LintOptions> = {}) =>
    lint({
      cwd: asAbsPath('/repo'),
      fs: createMemFileSystem(files),
      installationRoots: [],
      ...options,
    });

  it.each([
    { days: 3, violationExpected: false },
    { days: 100_000_000, violationExpected: true },
    { days: Number.MAX_SAFE_INTEGER, violationExpected: true },
  ])('uses the same cutoff bounds for Deno days/minutes: $days', ({ days, violationExpected }) => {
    const options = { installationRoots: ['.'], pm: 'deno' as const, pmVersion: '2.8.1' };
    const base = { 'deno.json': '{"lock":{"frozen":true}}', 'deno.lock': '{}' };
    const fallback = inspect({ ...base, '.npmrc': `min-release-age=${days}` }, options);
    const explicit = inspect(
      { ...base, 'deno.json': JSON.stringify({ minimumDependencyAge: days * 1440 }) },
      options,
    );
    const releaseAgeFindings = (result: ReturnType<typeof lint>) =>
      result.findings.filter((finding) => finding.ruleId === 'minimum-release-age');
    const expectedFindingCount = violationExpected ? 1 : 0;
    expect(releaseAgeFindings(fallback)).toHaveLength(expectedFindingCount);
    expect(releaseAgeFindings(explicit)).toHaveLength(expectedFindingCount);
  });
});

describe('Deno configuration precedence', () => {
  const inspectDeno = (files: Record<string, string>) =>
    lint({
      cwd: asAbsPath('/repo'),
      pm: 'deno',
      fs: createMemFileSystem({
        'package.json': '{"private":true}',
        ...files,
      }),
    });

  it('Deno honors a configured lockfile and explicit inactive age cannot be rescued by fallback', () => {
    const files = {
      'deno.json': '{"lock":"locks/custom.lock","minimumDependencyAge":{"age":0}}',
      'locks/custom.lock': '',
      '.npmrc': 'min-release-age=3',
    };
    const result = inspectDeno(files);
    expect(result.findings).not.toContainEqual(
      expect.objectContaining({ ruleId: 'commit-lockfile' }),
    );
    const ageFinding = expect.objectContaining({ ruleId: 'minimum-release-age' });
    expect(result.findings).toContainEqual(ageFinding);
    const fallback = inspectDeno({
      ...files,
      'deno.json': '{"lock":"locks/custom.lock","minimumDependencyAge":{}}',
    });
    expect(fallback.findings).not.toContainEqual(ageFinding);
  });
});

describe('Malformed settings', () => {
  const ctx = makeCtx();

  it.each(['pnpm', 'deno', 'yarn'] as const)(
    '%s does not treat an infinite release age as configured protection',
    (pm) => {
      const configs = {
        deno: { minimumDependencyAge: Infinity },
        pnpm: { minimumReleaseAge: Infinity },
        yarn: { npmMinimalAgeGate: Infinity },
      };
      expect(bindingForTest(minimumReleaseAge, pm).check(ctx, configs[pm]).state).toBe('violation');
    },
  );

  it.each([{ age: { age: 'P3D' } }, { exclude: [false] }, new Date()])(
    'does not accept a malformed Deno age object: %j',
    (value) => {
      expect(deno.check(ctx, { minimumDependencyAge: value }).state).toBe('violation');
    },
  );
});

it('clears an overriding before finding only after the proposed manual correction', () => {
  const original = 'min-release-age=3\nbefore=2999-01-01\n';
  const check = (npmrc: string) =>
    lint({
      cwd: asAbsPath('/repo'),
      fs: createMemFileSystem({ '.npmrc': npmrc }),
      pm: 'npm',
    }).findings.filter((finding) => finding.ruleId === 'minimum-release-age');
  expect(check(original)).toMatchObject([
    {
      severity: 'warn',
      remediation: {
        kind: 'manual',
        steps: expect.arrayContaining([expect.stringContaining('remove before')]),
      },
    },
  ]);
  expect(check(original.replace('min-release-age=3', 'min-release-age=7'))).toHaveLength(1);
  expect(check(original.replace('before=2999-01-01\n', ''))).toStrictEqual([]);
  expect(check('before=2020-01-01\n')).toStrictEqual([]);
});
