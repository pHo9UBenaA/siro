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
