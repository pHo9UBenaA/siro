import type { AutoRuleBinding, CheckStatus } from '../entities/rule.ts';
import {
  type VersionNote,
  overrideBindings,
  renderVersionNoteMessage,
  requireConfigKey,
} from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { npmrc, pnpmWorkspace, yarnrc, aubeWorkspace, bunfig } = CONFIG_FILES;

const pnpmStrictDepBuildsDocs = 'https://pnpm.io/settings#strictdepbuilds';
// Why not let `requireConfigKey` own this binding too? The builder models
// exactly one key per binding; pnpm's lifecycle-script story needs both
// `strictDepBuilds` (the gate) and `dangerouslyAllowAllBuilds` (the bypass).
// Sharing `renderVersionNoteMessage` keeps the rendering identical across the
// hand-written and builder-generated paths.
const pnpmVersionNote: VersionNote = {
  configAvailableSince: 'pnpm 10.3.0',
  defaultSafeSince: 'pnpm 11.0.0',
};
const pnpmMsg = (body: string): string => renderVersionNoteMessage(body, pnpmVersionNote);
const pnpmBinding: AutoRuleBinding = {
  check(_ctx, config): CheckStatus {
    const bypass = getByPath(config, ['dangerouslyAllowAllBuilds']);
    if (bypass === true) {
      // Bypass wins over strictDepBuilds — explicit error even if the user
      // also set strictDepBuilds: true (the two together are misleading).
      return {
        actual: bypass,
        expected: false,
        // siro will not ask a fixer to silently delete an explicit user
        // override, so the setKey fix op cannot resolve this case — the
        // manual steps carry the remediation and `fix` is suppressed.
        manualSteps: [
          'Remove `dangerouslyAllowAllBuilds: true` from pnpm-workspace.yaml (or set it to `false`). Setting `strictDepBuilds: true` alone has no effect while the bypass remains.',
        ],
        message: pnpmMsg(
          '`dangerouslyAllowAllBuilds: true` in pnpm-workspace.yaml bypasses strictDepBuilds — remove it (or set it to false) to restore lifecycle-script gating.',
        ),
        state: 'violation',
      };
    }
    const strict = getByPath(config, ['strictDepBuilds']);
    if (strict === true) {
      return { state: 'ok' };
    }
    if (typeof strict === 'undefined') {
      // strictDepBuilds defaults to true on the version recorded in pnpmVersionNote — advisory-only (documentedDefault parity).
      return {
        actual: strict,
        expected: true,
        message: pnpmMsg(
          'Set `strictDepBuilds: true` in pnpm-workspace.yaml to pin lifecycle-script gating across versions.',
        ),
        severity: 'info',
        state: 'violation',
      };
    }
    return {
      actual: strict,
      expected: true,
      message: pnpmMsg(
        'Set `strictDepBuilds: true` in pnpm-workspace.yaml to block silent skips of un-approved dep builds.',
      ),
      state: 'violation',
    };
  },
  docs: pnpmStrictDepBuildsDocs,
  file: pnpmWorkspace,
  fix() {
    // Intentionally do not auto-remove `dangerouslyAllowAllBuilds` — it
    // signals an explicit user override; surfacing the violation lets them
    // decide whether to drop it rather than having siro erase it silently.
    return [{ file: pnpmWorkspace, keyPath: ['strictDepBuilds'], op: 'setKey', value: true }];
  },
  fixKind: 'auto',
};

const aubeBinding: AutoRuleBinding = {
  check(_ctx, config): CheckStatus {
    const jail = getByPath(config, ['jailBuilds']);
    if (jail !== true) {
      return {
        actual: jail,
        expected: true,
        message: 'Set `jailBuilds: true` in aube-workspace.yaml to sandbox build scripts.',
        state: 'violation',
      };
    }
    const strict = getByPath(config, ['strictDepBuilds']);
    if (strict !== true) {
      return {
        actual: strict,
        expected: true,
        message:
          'Set `strictDepBuilds: true` in aube-workspace.yaml to require explicit allow/deny for lifecycle scripts.',
        state: 'violation',
      };
    }
    return { state: 'ok' };
  },
  docs: 'https://aube.jdx.dev/security.html',
  file: aubeWorkspace,
  fix() {
    return [
      { file: aubeWorkspace, keyPath: ['jailBuilds'], op: 'setKey', value: true },
      { file: aubeWorkspace, keyPath: ['strictDepBuilds'], op: 'setKey', value: true },
    ];
  },
  fixKind: 'auto',
};

const bunVersionNote: VersionNote = { configAvailableSince: 'bun 1.2.0' };
const bunMessage = renderVersionNoteMessage(
  'Set `ignoreScripts = true` under [install] in bunfig.toml — or set `"trustedDependencies": []` in package.json — to opt out of the curated allow-list (postinstall is already blocked for untrusted packages by default).',
  bunVersionNote,
);

// Hand-written for the same reason as pnpm: the rule's bun story spans two
// files. `install.ignoreScripts = true` (bunfig) and `"trustedDependencies":
// []` (package.json) are equivalent opt-outs, and the check must accept
// either — otherwise users who chose the package.json route keep seeing a
// violation whose fix op then adds a bunfig key they never
// wanted. The fix op targets only the bunfig key (builtin rules
// never emit a package.json setKey).
const bunBinding: AutoRuleBinding = {
  check(ctx, config): CheckStatus {
    const ignoreScripts = getByPath(config, ['install', 'ignoreScripts']);
    if (ignoreScripts === true) {
      return { state: 'ok' };
    }
    const EMPTY = 0;
    let trusted: string[] | undefined = void 0;
    if (ctx.packageJson) {
      trusted = ctx.packageJson.trustedDependencies;
    }
    if (typeof trusted !== 'undefined' && trusted.length === EMPTY) {
      return { state: 'ok' };
    }
    return { actual: ignoreScripts, expected: true, message: bunMessage, state: 'violation' };
  },
  docs: 'https://bun.com/docs/pm/lifecycle',
  file: bunfig,
  fix() {
    return [{ file: bunfig, keyPath: ['install', 'ignoreScripts'], op: 'setKey', value: true }];
  },
  fixKind: 'auto',
  severity: 'info',
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
// - deno: no binding — deno does not run install scripts; lifecycle
//   script gating is N/A.
//
// `requireConfigKey`'s single-key model can't express the strictDepBuilds +
// dangerouslyAllowAllBuilds combo pnpm needs, nor bun's two-file opt-out, so
// those slots are overridden post-hoc via `overrideBindings`.
export const disableLifecycleScripts = overrideBindings(builtRule, {
  aube: aubeBinding,
  bun: bunBinding,
  pnpm: pnpmBinding,
});
