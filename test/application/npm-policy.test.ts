import { lint } from '../../src/application/lint.ts';
import { asAbsPath } from '../../src/shared/paths.ts';
import { createMemFileSystem } from '../helpers/memfs.ts';

it.each(['application', 'package'] as const)(
  'accepts the npm private publish access alias under %s policy',
  (projectType) => {
    const fs = createMemFileSystem({
      'package.json': JSON.stringify({
        name: '@scope/example',
        packageManager: 'npm@12.0.2',
        publishConfig: { access: 'private' },
      }),
    });
    const result = lint({ cwd: asAbsPath('/repo'), fs, projectType });
    expect(result.findings.some((finding) => finding.ruleId === 'publish-access')).toBe(false);
  },
);

it.each([
  { pm: 'npm', npmrc: 'save-prefix=null', pinned: false },
  { pm: 'npm', npmrc: 'save-prefix="null"', pinned: false },
  { pm: 'npm', npmrc: 'save-prefix=', pinned: true },
  { pm: 'npm', npmrc: 'save-prefix=""', pinned: true },
  { pm: 'npm', npmrc: 'save-prefix==', pinned: true },
  { pm: 'npm', npmrc: '', pinned: false },
  { pm: 'npm', npmrc: 'save-prefix=null\nsave-exact=true', pinned: true },
  { pm: 'aube', npmrc: 'save-prefix=null', pinned: false },
  { pm: 'aube', npmrc: 'savePrefix=null', pinned: false },
  { pm: 'aube', npmrc: 'save-prefix=', pinned: true },
  { pm: 'aube', npmrc: 'save-prefix=\nsavePrefix=null', pinned: false },
] as const)('evaluates $pm pinning from the file: $npmrc', ({ pm, npmrc, pinned }) => {
  const fs = createMemFileSystem({ '.npmrc': npmrc });
  const result = lint({ cwd: asAbsPath('/repo'), fs, pm });
  expect(result.findings.some((finding) => finding.ruleId === 'pin-exact-versions')).toBe(!pinned);
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
      remediation: { kind: 'manual', steps: [expect.stringContaining('remove before')] },
    },
  ]);
  expect(check(original.replace('min-release-age=3', 'min-release-age=7'))).toHaveLength(1);
  expect(check(original.replace('before=2999-01-01\n', ''))).toStrictEqual([]);
  expect(check('before=2020-01-01\n')).toStrictEqual([]);
});
