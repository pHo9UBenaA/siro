import { asAbsPath, lint } from '../../../src/index.ts';
import { createMemFileSystem } from '../../helpers/memfs.ts';
import { bindingForTest } from '../../helpers/rules.ts';
import { publishAccess } from '../../../src/core/rules/publish-access.ts';
import { makePublishableCtx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';
import type { PackageJson } from '../../../src/core/contracts/package-json.ts';

const npm = bindingForTest(publishAccess, 'npm');

describe('publish-access (npm)', () => {
  it('is N/A for private packages', () => {
    expect(npm.check(makePublishableCtx({ packageJson: { private: true } }), {}).state).toBe('na');
  });

  it('requests manual access selection for a publishable package', () => {
    const status = npm.check(makePublishableCtx(), {});

    expect(status.state).toBe('violation');

    expect(manualSteps(status)[0]).toContain('publishConfig');
  });

  it.each(['public', 'restricted'] as const)('accepts %s publication access', (access) => {
    const context = makePublishableCtx({ packageJson: { publishConfig: { access } } });
    expect(npm.check(context, {}).state).toBe('ok');
  });

  it('accepts the private alias only for npm and preserves application scope', () => {
    const packageJson = {
      name: '@scope/example',
      publishConfig: { access: 'private' },
    } satisfies PackageJson;
    expect(npm.check(makePublishableCtx({ packageJson }), {}).state).toBe('ok');
    expect(
      npm.check(makePublishableCtx({ packageJson, projectType: 'application' }), {}).state,
    ).toBe('na');
    expect(
      bindingForTest(publishAccess, 'yarn').check(makePublishableCtx({ packageJson }), {}).state,
    ).toBe('violation');
  });
});

it('accepts the npm private publish access alias under package policy', () => {
  const fs = createMemFileSystem({
    'package.json': JSON.stringify({
      name: '@scope/example',
      packageManager: 'npm@12.0.2',
      publishConfig: { access: 'private' },
    }),
  });
  const result = lint({ cwd: asAbsPath('/repo'), fs, projectType: 'package' });
  expect(result.findings).not.toContainEqual(expect.objectContaining({ ruleId: 'publish-access' }));
});
