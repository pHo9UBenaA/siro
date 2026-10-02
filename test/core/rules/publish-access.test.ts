import { bindingForTest } from '../../helpers/rules.ts';
import assert from 'node:assert';
import { publishAccess } from '../../../src/core/rules/publish-access.ts';
import { makePublishableCtx as ctx } from '../../helpers/ctx.ts';
import { manualSteps } from '../../helpers/remediation.ts';

const npm = bindingForTest(publishAccess, 'npm');

describe('publish-access (npm)', () => {
  it('is N/A for private packages', () => {
    expect(npm.check(ctx({ packageJson: { private: true } }), {}).state).toBe('na');
  });

  it('requests manual access selection for a publishable package', () => {
    const status = npm.check(ctx(), {});

    expect(status.state).toBe('violation');

    const steps = manualSteps(status);

    const firstStep = steps[0];
    assert(firstStep, 'expected at least one manual step');
    expect(firstStep).toContain('publishConfig');
  });

  it('passes for "public" or "restricted"', () => {
    const passes = (access: 'public' | 'restricted'): string =>
      npm.check(ctx({ packageJson: { publishConfig: { access } } }), {}).state;
    expect(passes('public')).toBe('ok');
    expect(passes('restricted')).toBe('ok');
  });

  it('accepts the private alias only for npm and preserves application scope', () => {
    const packageJson = { name: '@scope/example', publishConfig: { access: 'private' as const } };
    expect(npm.check(ctx({ packageJson }), {}).state).toBe('ok');
    expect(npm.check(ctx({ packageJson, projectType: 'application' }), {}).state).toBe('na');
    expect(publishAccess.bindings.yarn?.check(ctx({ packageJson }), {}).state).toBe('violation');
  });
});
