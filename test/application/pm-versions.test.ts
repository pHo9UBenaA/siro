import {
  asAbsPath,
  lint,
  type LintOptions,
  UsageError,
  ConfigError,
  PMS,
  defineRule,
} from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

const evaluate = (packageManager: string, options: Partial<LintOptions> = {}) =>
  lint({
    cwd: asAbsPath('/repo'),
    fs: createMemFileSystem({
      'package.json': JSON.stringify({ packageManager, private: true }),
      '.npmrc': 'min-release-age=3\nignore-scripts=true\n',
      'pnpm-workspace.yaml': 'minimumReleaseAge: 4320\n',
    }),
    ...options,
  });
const unsupported = (result: ReturnType<typeof lint>) =>
  result.findings.filter((finding) => finding.ruleId === 'unsupported-settings');

it('reports a configured npm security setting that predates its introduction', () => {
  const result = evaluate('npm@11.9.0', { pm: 'npm' });
  expect(unsupported(result)).toEqual([
    expect.objectContaining({
      pm: 'npm',
      file: '.npmrc',
      severity: 'error',
      message: expect.stringContaining('min-release-age'),
      remediation: expect.objectContaining({ kind: 'manual' }),
    }),
  ]);
  expect(unsupported(result)[0]?.message).toContain('11.10.0');
  expect(result.findings.some((finding) => finding.ruleId === 'minimum-release-age')).toBe(false);
});

it.each(['11.10.0', '11.10.0+sha512.abcdef', '12.0.0'])(
  'accepts the introduction boundary and newer stable npm versions: %s',
  (version) => {
    expect(unsupported(evaluate(`npm@${version}`, { pm: 'npm' }))).toEqual([]);
  },
);

it.each(['npm', 'npm@latest', 'npm@^11.9.0', 'npm@11.10.0-rc.1'])(
  'does not guess a stable target from %s',
  (declaration) => {
    expect(unsupported(evaluate(declaration, { pm: 'npm' }))).toEqual([]);
  },
);

it('keeps a manifest version attached to its own manager', () => {
  expect(unsupported(evaluate('npm@11.9.0', { pm: 'pnpm' }))).toEqual([]);
  expect(unsupported(evaluate('npm@11.9.0')).map((finding) => finding.pm)).toEqual(['npm']);
});

it('uses explicit option, then config, then declaration, independently per manager', () => {
  const config = { pmVersions: { npm: '11.10.0', pnpm: '10.15.0' } };
  expect(unsupported(evaluate('npm@11.9.0', { config })).map((finding) => finding.pm)).toEqual([
    'pnpm',
  ]);
  expect(
    unsupported(evaluate('npm@11.9.0', { config, pm: 'npm', pmVersion: '11.8.0' })),
  ).toHaveLength(1);
});

it('requires a manager for an explicit version', () => {
  expect(() => evaluate('npm@11.9.0', { pmVersion: '11.10.0' })).toThrow(UsageError);
});

it.each(['latest', '^11.10.0', '11', '11.10.0-rc.1', '', 'v11.10.0', ' 11.10.0', 11, null])(
  'rejects an ambiguous explicit target: %s',
  (pmVersion) => {
    expect(() => evaluate('npm@11.9.0', { pm: 'npm', pmVersion } as Partial<LintOptions>)).toThrow(
      UsageError,
    );
    expect(() =>
      evaluate('npm@11.9.0', {
        config: { pmVersions: { npm: pmVersion } },
      } as Partial<LintOptions>),
    ).toThrow(ConfigError);
  },
);

it('does not let a version map select managers or bypass its validation', () => {
  expect(
    unsupported(evaluate('npm@11.10.0', { pm: 'npm', config: { pmVersions: { pnpm: '1.0.0' } } })),
  ).toEqual([]);
  for (const pmVersions of [
    { cargo: '1.0.0' },
    { constructor: '1.0.0' },
    JSON.parse('{"__proto__":"1.0.0"}'),
    [],
    Object.create({ npm: '1.0.0' }),
  ]) {
    expect(() =>
      evaluate('npm@11.10.0', { config: { pmVersions } } as Partial<LintOptions>),
    ).toThrow(ConfigError);
  }
});

it('gives each custom binding its own target and preserves unknown versions', () => {
  const seen: (string | undefined)[] = [];
  const probe = defineRule({
    id: 'version-probe',
    title: 'Version probe',
    description: 'Observe the target',
    severity: 'info',
    bindings: Object.fromEntries(
      PMS.map((pm) => [
        pm,
        {
          check(ctx: { pmVersion?: string }) {
            seen.push(ctx.pmVersion);
            return { state: 'ok' as const };
          },
        },
      ]),
    ),
  });
  for (const pm of PMS) {
    evaluate('npm@11.10.0', {
      pm,
      config: { pmVersions: { pnpm: '10.16.0' }, customRules: [probe] },
    });
  }
  expect(seen).toEqual(['11.10.0', '10.16.0', undefined, undefined, undefined, undefined]);
});

it('keeps omitted version-dependent defaults at the existing severity', () => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'pnpm',
    pmVersion: '11.7.0',
    fs: createMemFileSystem({}),
  });
  expect(
    result.findings.find((finding) => finding.ruleId === 'minimum-release-age')?.severity,
  ).toBe('warn');
  expect(unsupported(result)).toEqual([]);
});

it('honors rule disabling and severity overrides', () => {
  expect(
    unsupported(evaluate('npm@11.9.0', { config: { rules: { 'unsupported-settings': 'off' } } })),
  ).toEqual([]);
  expect(
    unsupported(
      evaluate('npm@11.9.0', { config: { rules: { 'unsupported-settings': 'warn' } } }),
    )[0]?.severity,
  ).toBe('warn');
});
