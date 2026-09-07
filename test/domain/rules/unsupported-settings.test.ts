import { asAbsPath, lint, type PM } from '../../../src/index.ts';
import { createMemFileSystem } from '../../helpers/memfs.ts';

// Independent boundary examples from the release sources in docs/rules.md.
it.each([
  ['npm', '.npmrc', 'provenance=true', '9.4.2', '9.5.0'],
  ['npm', 'package.json', '{"publishConfig":{"provenance":true}}', '9.4.2', '9.5.0'],
  ['npm', '.npmrc', 'min-release-age=3', '11.9.0', '11.10.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'strictDepBuilds: true', '10.5.2', '10.6.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'dangerouslyAllowAllBuilds: false', '10.8.1', '10.9.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'minimumReleaseAge: 4320', '10.15.1', '10.16.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'minimumReleaseAgeExclude: []', '10.15.1', '10.16.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'trustPolicy: no-downgrade', '10.20.0', '10.21.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'blockExoticSubdeps: true', '10.25.0', '10.26.0'],
  ['pnpm', 'pnpm-workspace.yaml', 'frozenStore: true', '11.6.0', '11.7.0'],
  ['yarn', '.yarnrc.yml', 'enableHardenedMode: true', '3.8.7', '4.0.0'],
  ['yarn', '.yarnrc.yml', 'npmMinimalAgeGate: 4320', '4.9.4', '4.10.0'],
  ['yarn', '.yarnrc.yml', 'npmPreapprovedPackages: []', '4.9.4', '4.10.0'],
  ['bun', 'bunfig.toml', '[install]\nminimumReleaseAge = 259200', '1.2.23', '1.3.0'],
  ['bun', 'bunfig.toml', '[install.security]\nscanner = "@acme/scanner"', '1.2.20', '1.2.21'],
] as const)('%s %s %s requires %s -> %s', (pm, file, content, before, since) => {
  const evaluateVersion = (pmVersion: string) =>
    lint({
      cwd: asAbsPath('/repo'),
      pm,
      pmVersion,
      fs: createMemFileSystem({ [file]: content }),
    }).findings.filter((finding) => finding.ruleId === 'unsupported-settings');
  const findings = evaluateVersion(before);
  expect(findings).toHaveLength(1);
  expect(findings[0]?.file).toBe(file);
  expect(findings[0]?.message).toContain(since);
  expect(evaluateVersion(since)).toEqual([]);
});

it('reports every affected key across files, without suggesting an automatic removal', () => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'npm',
    pmVersion: '9.4.2',
    fs: createMemFileSystem({
      '.npmrc': 'provenance=false\nmin-release-age=3',
      'package.json': '{"publishConfig":{"provenance":true}}',
    }),
  });
  const finding = result.findings.find((item) => item.ruleId === 'unsupported-settings');
  expect(finding?.message).toContain('.npmrc#provenance');
  expect(finding?.message).toContain('package.json#publishConfig.provenance');
  expect(finding?.message).toContain('.npmrc#min-release-age');
  expect(finding?.remediation?.kind).toBe('manual');
});

it.each([false, 0, null, ''])('checks presence even when the configured value is %s', (value) => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'pnpm',
    pmVersion: '10.15.0',
    fs: createMemFileSystem({
      'pnpm-workspace.yaml': JSON.stringify({ minimumReleaseAge: value }),
    }),
  });
  expect(result.findings.some((finding) => finding.ruleId === 'unsupported-settings')).toBe(true);
});

it('does not reinterpret a supported alternative or an unlisted key', () => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'npm',
    pmVersion: '10.9.0',
    fs: createMemFileSystem({ '.npmrc': 'before=2020-01-01\nignore-scripts=true\nunknown=true' }),
  });
  expect(
    result.findings.filter((finding) =>
      ['unsupported-settings', 'minimum-release-age', 'disable-lifecycle-scripts'].includes(
        finding.ruleId,
      ),
    ),
  ).toEqual([]);
});

it.each(['deno', 'aube'] satisfies PM[])('does not invent introduction history for %s', (pm) => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm,
    pmVersion: '1.0.0',
    fs: createMemFileSystem({
      'deno.json': '{"minimumDependencyAge":"P3D"}',
      'aube-workspace.yaml': 'minimumReleaseAge: 4320',
    }),
  });
  expect(result.findings.some((finding) => finding.ruleId === 'unsupported-settings')).toBe(false);
});
