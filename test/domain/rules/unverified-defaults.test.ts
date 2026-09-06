import assert from 'node:assert';
import type { Rule } from '../../../src/domain/entities/rule.ts';
import type { PM } from '../../../src/domain/entities/pms.ts';
import { blockExoticSubdeps } from '../../../src/domain/rules/block-exotic-subdeps.ts';
import { disableLifecycleScripts } from '../../../src/domain/rules/disable-lifecycle-scripts.ts';
import { frozenLockfile } from '../../../src/domain/rules/frozen-lockfile.ts';
import { hardenedMode } from '../../../src/domain/rules/hardened-mode.ts';
import { minimumReleaseAge } from '../../../src/domain/rules/minimum-release-age.ts';
import { makeCtx } from '../../helpers/ctx.ts';

const VERSION_OR_ENVIRONMENT_DEPENDENT_DEFAULTS = [
  ['disable-lifecycle-scripts on pnpm', disableLifecycleScripts, 'pnpm'],
  ['disable-lifecycle-scripts on yarn', disableLifecycleScripts, 'yarn'],
  ['frozen-lockfile on pnpm', frozenLockfile, 'pnpm'],
  ['frozen-lockfile on yarn', frozenLockfile, 'yarn'],
  ['hardened-mode on yarn', hardenedMode, 'yarn'],
  ['block-exotic-subdeps on npm', blockExoticSubdeps, 'npm'],
  ['block-exotic-subdeps on pnpm', blockExoticSubdeps, 'pnpm'],
  ['minimum-release-age on pnpm', minimumReleaseAge, 'pnpm'],
  ['minimum-release-age on yarn', minimumReleaseAge, 'yarn'],
  ['minimum-release-age on deno', minimumReleaseAge, 'deno'],
] as const satisfies readonly (readonly [string, Rule, PM])[];

describe('unverified package-manager defaults', () => {
  it.each(VERSION_OR_ENVIRONMENT_DEPENDENT_DEFAULTS)(
    'keeps %s at its configured severity when the setting is absent',
    (_name, rule, pm) => {
      expect.hasAssertions();
      const binding = rule.bindings[pm];
      assert(binding, `expected ${rule.id} binding for ${pm}`);
      const status = binding.check(makeCtx(), {});
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );
});
