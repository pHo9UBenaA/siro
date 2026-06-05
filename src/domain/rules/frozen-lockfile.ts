import type { AutoRuleBinding, CheckStatus } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { pnpmWorkspace, yarnrc, bunfig, denoJson, aubeWorkspace } = CONFIG_FILES;

const denoLockMessage = 'Set `lock.frozen: true` in deno.json for reproducible, verified installs.';

// Hand-written so the binding can distinguish "lock is unset / a mapping"
// (safe to emit a `lock.frozen` setKey op) from "lock holds an explicit scalar"
// (a custom lockfile path, or `false` to disable). requireConfigKey would
// emit `lock.frozen` in the scalar case, silently clobbering the user's
// value — so that case becomes a manual step instead.
const denoBinding: AutoRuleBinding = {
  check(_ctx, config): CheckStatus {
    if (getByPath(config, ['lock', 'frozen']) === true) {
      return { state: 'ok' };
    }
    const lock = getByPath(config, ['lock']);
    const lockIsScalar =
      typeof lock !== 'undefined' &&
      (typeof lock !== 'object' || lock === null || Array.isArray(lock));
    const base = {
      actual: getByPath(config, ['lock', 'frozen']),
      expected: true,
      message: denoLockMessage,
      state: 'violation',
    } as const;
    if (lockIsScalar) {
      return Object.assign({}, base, {
        manualSteps: [
          'deno.json `lock` is set to a non-object value; writing `lock.frozen: true` under it would overwrite that value. Set it yourself, or make `lock` an object first.',
        ],
      });
    }
    return base;
  },
  docs: 'https://docs.deno.com/runtime/fundamentals/configuration/#lock',
  file: denoJson,
  fix() {
    return [{ file: denoJson, keyPath: ['lock', 'frozen'], op: 'setKey', value: true }];
  },
  fixKind: 'auto',
};

const builtRule = requireConfigKey({
  bindings: {
    aube: {
      docs: 'https://aube.en.dev/settings/',
      documentedDefault: true,
      file: aubeWorkspace,
      keyPath: ['preferFrozenLockfile'],
      message:
        'aube defaults preferFrozenLockfile to true — set it explicitly in aube-workspace.yaml to pin the policy across versions.',
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
      documentedDefault: true,
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

// deno's binding is hand-written (see `denoBinding`) so it can refuse to
// clobber a non-object `lock`; the builder can't express that conditional.
export const frozenLockfile = overrideBindings(builtRule, { deno: denoBinding });
