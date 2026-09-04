import type { AutoRuleBinding, CheckStatus } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { aubeWorkspace, npmrc, pnpmWorkspace } = CONFIG_FILES;

const isRootOrNone = (value: unknown): boolean => value === 'root' || value === 'none';

const npmMessage =
  'Set `allow-git=none` and `allow-remote=none` in .npmrc to block git/tarball URLs; use `root` only when direct URL dependencies are required.';

const npmBinding: AutoRuleBinding = {
  check(_ctx, config): CheckStatus {
    const git = getByPath(config, ['allow-git']);
    if (typeof git !== 'undefined' && !isRootOrNone(git)) {
      return { actual: git, expected: 'none', message: npmMessage, state: 'violation' };
    }
    const remote = getByPath(config, ['allow-remote']);
    if (typeof remote !== 'undefined' && !isRootOrNone(remote)) {
      return { actual: remote, expected: 'none', message: npmMessage, state: 'violation' };
    }
    if (typeof git === 'undefined' || typeof remote === 'undefined') {
      return {
        expected: 'none',
        message: `npm defaults unset URL restrictions to none. ${npmMessage}`,
        severity: 'info',
        state: 'violation',
      };
    }
    return { state: 'ok' };
  },
  docs: 'https://docs.npmjs.com/cli/v12/using-npm/config#allow-git',
  file: npmrc,
  fix() {
    return [
      { file: npmrc, keyPath: ['allow-git'], op: 'setKey', value: 'none' },
      { file: npmrc, keyPath: ['allow-remote'], op: 'setKey', value: 'none' },
    ];
  },
  fixKind: 'auto',
  versionNote: { defaultSafeSince: 'npm 12.0.0' },
};

const builtRule = requireConfigKey({
  bindings: {
    aube: {
      docs: 'https://aube.jdx.dev/security.html',
      documentedDefault: true,
      file: aubeWorkspace,
      keyPath: ['blockExoticSubdeps'],
      message:
        'Set `blockExoticSubdeps: true` in aube-workspace.yaml to block git/tarball URLs in transitive dependencies.',
      value: true,
    },
    pnpm: {
      docs: 'https://pnpm.io/settings#blockexoticsubdeps',
      documentedDefault: true,
      file: pnpmWorkspace,
      keyPath: ['blockExoticSubdeps'],
      message:
        'Set `blockExoticSubdeps: true` in pnpm-workspace.yaml to block git/tarball URLs in transitive dependencies.',
      value: true,
      versionNote: {
        configAvailableSince: 'pnpm 10.26.0',
        defaultSafeSince: 'pnpm 10.26.0',
      },
    },
  },
  description:
    'Refuse to install transitive dependencies sourced from git or tarball URLs, which bypass registry integrity checking.',
  docs: 'https://pnpm.io/settings#blockexoticsubdeps',
  id: 'block-exotic-subdeps',
  severity: 'warn',
  title: 'Block exotic subdependencies',
});

export const blockExoticSubdeps = overrideBindings(builtRule, { npm: npmBinding });
