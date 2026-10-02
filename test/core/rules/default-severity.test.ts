import assert from 'node:assert';
import { type Rule } from '../../../src/core/contracts/rule.ts';
import { type PM } from '../../../src/core/contracts/pms.ts';
import { blockExoticSubdeps } from '../../../src/core/rules/block-exotic-subdeps.ts';
import { disableLifecycleScripts } from '../../../src/core/rules/disable-lifecycle-scripts.ts';
import { frozenLockfile } from '../../../src/core/rules/frozen-lockfile.ts';
import { hardenedMode } from '../../../src/core/rules/hardened-mode.ts';
import { bindingForTest, minimumReleaseAge } from '../../helpers/rules.ts';
import { makeCtx, makePublishableCtx } from '../../helpers/ctx.ts';
import { codecFor } from '../../../src/adapters/codecs/store.ts';
import { runLint } from '../../../src/core/run-lint.ts';
import { createRepositoryEvaluation } from '../../../src/core/parse-config-file.ts';
import { advisoryCheck } from '../../../src/core/rules/advisory-check.ts';
import { trustPolicy } from '../../../src/core/rules/trust-policy.ts';

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
      const binding = bindingForTest(rule, pm);

      const status = binding.check(makeCtx(), {});
      assert(status.state === 'violation');
      expect(status.severity).toBeUndefined();
    },
  );
});

describe('aube policy', () => {
  const ctx = makePublishableCtx;
  it('uses the documented advisory and trust defaults without downgrading explicit opt-outs', () => {
    for (const [source, severity] of [
      ['', 'info'],
      ['advisoryCheck: off\ntrustPolicy: off', 'warn'],
    ] as const) {
      const result = runLint({
        repository: createRepositoryEvaluation(ctx({ readText: () => source }), codecFor),
        targets: [{ pm: 'aube' }],
        ruleSet: [advisoryCheck, trustPolicy],
      });
      expect(result.findings.map((finding) => [finding.ruleId, finding.severity])).toEqual([
        ['advisory-check', severity],
        ['trust-policy', severity],
      ]);
    }
  });
});
