import { asAbsPath, asRelPath, lint } from '../../src/index.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

it.each([
  ['npm', 'minimum-release-age', '11.9.0', '11.10.0'],
  ['pnpm', 'trust-policy', '10.20.0', '10.21.0'],
  ['bun', 'bun-security-scanner', '1.2.20', '1.2.21'],
  ['pnpm', 'frozen-store', '11.6.0', '11.7.0'],
] as const)('qualifies %s %s proposals for an unsupported target', (pm, ruleId, before, since) => {
  const findings = lint({
    cwd: asAbsPath('/repo'),
    pm,
    pmVersion: before,
    fs: createMemFileSystem({}),
  }).findings;
  const finding = findings.find((item) => item.ruleId === ruleId);
  expect(finding).toBeDefined();
  expect(finding?.remediation?.kind).toBe('manual');
  expect(finding?.remediation?.steps?.[0]).toContain(`>=${since}`);
});

it.each([undefined, '11.10.0'])(
  'preserves automatic proposals when npm target is %s',
  (pmVersion) => {
    const result = lint({
      cwd: asAbsPath('/repo'),
      pm: 'npm',
      pmVersion,
      fs: createMemFileSystem({}),
    });
    expect(
      result.findings.find((item) => item.ruleId === 'minimum-release-age')?.remediation?.kind,
    ).toBe('automatic');
  },
);

it('retains the supported npm before alternative and qualifies only min-release-age', () => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'npm',
    pmVersion: '11.9.0',
    fs: createMemFileSystem({ '.npmrc': 'before=false' }),
  });
  const steps = result.findings.find((item) => item.ruleId === 'minimum-release-age')?.remediation
    ?.steps;
  expect(steps?.[0]).toContain('set before to a valid past date');
  expect(steps?.[1]).toContain('>=11.10.0');
});

it.each([
  [
    'pnpm',
    'pnpm-workspace.yaml',
    'strictDepBuilds: {}',
    '10.5.0',
    'disable-lifecycle-scripts',
    '10.6.0',
  ],
  ['bun', 'bunfig.toml', 'install=false', '1.2.0', 'minimum-release-age', '1.3.0'],
] as const)(
  'retains structural review and version prerequisites for %s',
  (pm, file, content, pmVersion, id, since) => {
    const result = lint({
      cwd: asAbsPath('/repo'),
      pm,
      pmVersion,
      fs: createMemFileSystem({ [file]: content }),
    });
    const remedy = result.findings.find((item) => item.ruleId === id)?.remediation;
    expect(remedy?.steps?.[0]).toContain(`>=${since}`);
    expect(remedy?.steps?.[1]).toContain('Review');
  },
);

it('does not claim an unsupported bypass removal restores script gating', () => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'pnpm',
    pmVersion: '10.5.0',
    fs: createMemFileSystem({ 'pnpm-workspace.yaml': 'dangerouslyAllowAllBuilds: true' }),
  });
  const finding = result.findings.find((item) => item.ruleId === 'disable-lifecycle-scripts');
  expect(finding?.remediation?.steps?.[0]).toContain('>=10.6.0');
  expect(finding?.message).toContain('alone does not provide protection');
});

it('guards a custom automatic proposal atomically without changing severity', () => {
  const result = lint({
    cwd: asAbsPath('/repo'),
    pm: 'npm',
    pmVersion: '11.9.0',
    fs: createMemFileSystem({}),
    config: {
      rules: { 'custom-age': 'error' },
      customRules: [
        {
          id: 'custom-age',
          title: 'Age',
          description: 'Age',
          severity: 'warn',
          bindings: {
            npm: {
              check: () => ({
                state: 'violation',
                message: 'Set controls',
                remediation: {
                  kind: 'automatic',
                  operations: [
                    {
                      op: 'setKey',
                      file: { kind: 'npmrc', path: asRelPath('.npmrc') },
                      keyPath: ['ignore-scripts'],
                      value: true,
                    },
                    {
                      op: 'setKey',
                      file: { kind: 'npmrc', path: asRelPath('.npmrc') },
                      keyPath: ['min-release-age'],
                      value: 3,
                    },
                  ],
                },
              }),
            },
          },
        },
      ],
    },
  });
  const finding = result.findings.find((item) => item.ruleId === 'custom-age');
  expect(finding?.severity).toBe('error');
  expect(finding?.remediation?.kind).toBe('manual');
  expect(finding?.remediation?.steps).toHaveLength(3);
  expect(finding?.remediation?.steps?.join('\n')).toContain('ignore-scripts');
});
