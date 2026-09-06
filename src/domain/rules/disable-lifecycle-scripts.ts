import { proposeChanges } from './remediation.ts';
import { withAubeParanoid } from './builders/with-aube-paranoid.ts';
import type { RuleBinding, CheckStatus, VersionNote } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { npmrc, pnpmWorkspace, yarnrc, aubeWorkspace, bunfig } = CONFIG_FILES;

const pnpmStrictDepBuildsDocs = 'https://pnpm.io/settings#strictdepbuilds';
const pnpmVersionNote: VersionNote = {
  configAvailableSince: 'pnpm 10.3.0',
  defaultSafeSince: 'pnpm 11.0.0',
};
const pnpmBinding: RuleBinding = {
  check(_ctx, config): CheckStatus {
    if (getByPath(config, ['ignoreScripts']) === true) return { state: 'ok' };
    const bypass = getByPath(config, ['dangerouslyAllowAllBuilds']);
    if (bypass === true) {
      return {
        actual: bypass,
        expected: false,
        remediation: {
          kind: 'manual',
          steps: [
            'Remove `dangerouslyAllowAllBuilds: true` from pnpm-workspace.yaml (or set it to `false`). Setting `strictDepBuilds: true` alone has no effect while the bypass remains.',
          ],
        },
        message:
          '`dangerouslyAllowAllBuilds: true` in pnpm-workspace.yaml bypasses strictDepBuilds — remove it (or set it to false) to restore lifecycle-script gating.',
        state: 'violation',
      };
    }
    const strict = getByPath(config, ['strictDepBuilds']);
    if (strict === true) {
      return { state: 'ok' };
    }
    return {
      state: 'violation',
      actual: strict,
      expected: true,
      message:
        strict === undefined
          ? 'Set `strictDepBuilds: true` in pnpm-workspace.yaml to pin lifecycle-script gating across versions.'
          : 'Set `strictDepBuilds: true` in pnpm-workspace.yaml to block silent skips of un-approved dep builds.',
      remediation: proposeChanges(config, [
        { file: pnpmWorkspace, keyPath: ['strictDepBuilds'], op: 'setKey', value: true },
      ]),
    };
  },
  docs: pnpmStrictDepBuildsDocs,
  file: pnpmWorkspace,

  versionNote: pnpmVersionNote,
};

const aubeBinding: RuleBinding = {
  check(ctx, config): CheckStatus {
    const npmConfig = ctx.readConfig(npmrc);
    const jail = getByPath(config, ['jailBuilds']);
    const strict = getByPath(npmConfig, ['strictDepBuilds']);
    if (jail === true && strict === true) return { state: 'ok' };
    const jailRemedy = proposeChanges(config, [
      { file: aubeWorkspace, keyPath: ['jailBuilds'], op: 'setKey', value: true },
    ]);
    const strictRemedy = proposeChanges(npmConfig, [
      { file: npmrc, keyPath: ['strictDepBuilds'], op: 'setKey', value: true },
    ]);
    return {
      state: 'violation',
      file: jail !== true ? aubeWorkspace.path : npmrc.path,
      actual: jail !== true ? jail : strict,
      expected: true,
      message:
        'Set `jailBuilds: true` in aube-workspace.yaml and `strictDepBuilds=true` in .npmrc to sandbox approved builds and reject unreviewed lifecycle scripts.',
      remediation:
        jailRemedy.kind === 'automatic' && strictRemedy.kind === 'automatic'
          ? {
              kind: 'automatic',
              operations: [...jailRemedy.operations, ...strictRemedy.operations],
            }
          : {
              kind: 'manual',
              steps: [
                ...(jailRemedy.kind === 'manual'
                  ? jailRemedy.steps
                  : (['Set `jailBuilds: true` in aube-workspace.yaml.'] as const)),
                ...(strictRemedy.kind === 'manual'
                  ? strictRemedy.steps
                  : (['Set `strictDepBuilds=true` in .npmrc.'] as const)),
              ],
            },
    };
  },
  docs: 'https://aube.jdx.dev/security.html',
  file: aubeWorkspace,
};

const bunMessage =
  'Set `ignoreScripts = true` under [install] in bunfig.toml — or set `"trustedDependencies": []` in package.json — to opt out of the curated allow-list (postinstall is already blocked for untrusted packages by default).';

const bunBinding: RuleBinding = {
  check(ctx, config): CheckStatus {
    const ignoreScripts = getByPath(config, ['install', 'ignoreScripts']);
    if (ignoreScripts === true) {
      return { state: 'ok' };
    }
    const trusted = ctx.packageJson?.trustedDependencies;
    if (typeof trusted !== 'undefined' && trusted.length === 0) {
      return { state: 'ok' };
    }
    return {
      remediation: proposeChanges(config, [
        { file: bunfig, keyPath: ['install', 'ignoreScripts'], op: 'setKey', value: true },
      ]),
      actual: ignoreScripts,
      expected: true,
      message: bunMessage,
      state: 'violation',
    };
  },
  docs: 'https://bun.com/docs/pm/lifecycle',
  file: bunfig,

  severity: 'info',
  versionNote: { configAvailableSince: 'bun 1.2.0' },
};
const builtRule = requireConfigKey({
  bindings: {
    npm: {
      docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#ignore-scripts',
      file: npmrc,
      keyPath: ['ignore-scripts'],
      message: 'Set `ignore-scripts=true` in .npmrc to block dependency lifecycle scripts.',
      value: true,
    },
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#enableScripts',
      documentedDefault: false,
      file: yarnrc,
      keyPath: ['enableScripts'],
      message: 'Set `enableScripts: false` in .yarnrc.yml to pin the policy across versions.',
      value: false,
      versionNote: { configAvailableSince: 'yarn 2.0.0', defaultSafeSince: 'yarn 4.14.0' },
    },
  },
  description:
    'Malicious postinstall scripts are a primary supply-chain attack vector. Prevent automatic execution of dependency lifecycle scripts.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#3-disable-lifecycle-scripts',
  id: 'disable-lifecycle-scripts',
  severity: 'error',
  title: 'Disable dependency lifecycle scripts',
});

// Coverage notes:
// - deno: no binding — dependency scripts are blocked by default;
//   explicit allowScripts opt-ins are not audited here.
export const disableLifecycleScripts = withAubeParanoid(
  overrideBindings(builtRule, {
    aube: aubeBinding,
    bun: bunBinding,
    pnpm: pnpmBinding,
  }),
);
