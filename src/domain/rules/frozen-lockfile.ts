import type { RuleBinding, CheckStatus } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';

const { pnpmWorkspace, yarnrc, bunfig, denoJson } = CONFIG_FILES;

const aubeFrozenCommand =
  'Use `aube ci` or `aube install --frozen-lockfile` to fail when the lockfile would change.';

const aubeBinding: RuleBinding = {
  check(): CheckStatus {
    return {
      remediation: { kind: 'manual', steps: [aubeFrozenCommand] },
      message:
        '`preferFrozenLockfile` only reuses an up-to-date lockfile; it does not prevent updates. Verify that install commands enforce a frozen lockfile.',
      state: 'violation',
    };
  },
  docs: 'https://github.com/aubepkg/aube/blob/main/docs/cli/ci.md',

  severity: 'info',
};

const builtRule = requireConfigKey({
  bindings: {
    deno: {
      docs: 'https://docs.deno.com/runtime/fundamentals/configuration/#lock',
      file: denoJson,
      keyPath: ['lock', 'frozen'],
      message: 'Set `lock.frozen: true` in deno.json for reproducible, verified installs.',
      value: true,
    },
    bun: {
      docs: 'https://bun.com/docs/runtime/bunfig#install-frozenlockfile',
      file: bunfig,
      keyPath: ['install', 'frozenLockfile'],
      message:
        'Set `frozenLockfile = true` under [install] in bunfig.toml so installs fail when the lockfile would change.',
      value: true,
      versionNote: { configAvailableSince: 'bun 0.6.10' },
    },
    pnpm: {
      docs: 'https://pnpm.io/settings#frozenlockfile',
      file: pnpmWorkspace,
      keyPath: ['frozenLockfile'],
      message:
        'pnpm defaults frozenLockfile to true in CI — set it explicitly in pnpm-workspace.yaml to pin the policy outside CI too.',
      value: true,
    },
    yarn: {
      docs: 'https://yarnpkg.com/configuration/yarnrc#enableImmutableInstalls',
      documentedDefault: true,
      file: yarnrc,
      keyPath: ['enableImmutableInstalls'],
      message:
        'Set `enableImmutableInstalls: true` in .yarnrc.yml to pin the policy outside CI too.',
      value: true,
      versionNote: {
        configAvailableSince: 'yarn 2.0.0',
        defaultSafeSince: 'yarn 3.0.0 in CI',
      },
    },
  },
  description:
    'Refuse to mutate the lockfile on install so unexpected dependency changes fail loudly.',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#2-include-lockfiles',
  id: 'frozen-lockfile',
  severity: 'warn',
  title: 'Freeze the lockfile',
});

export const frozenLockfile = overrideBindings(builtRule, { aube: aubeBinding });
