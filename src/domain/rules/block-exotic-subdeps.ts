import type { AutoRuleBinding, CheckStatus } from '../entities/rule.ts';
import { overrideBindings, requireConfigKey } from './builders/require-config-key.ts';
import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';

const { aubeWorkspace, npmrc, pnpmWorkspace } = CONFIG_FILES;

const isRootOrNone = (value: unknown): boolean => value === 'root' || value === 'none';

const npmMessage =
  'Set `allow-git=root` and `allow-remote=root` in .npmrc to block git/tarball URLs in transitive dependencies.';

const npmBinding: AutoRuleBinding = {
  check(_ctx, config): CheckStatus {
    const git = getByPath(config, ['allow-git']);
    if (!isRootOrNone(git)) {
      return { actual: git, expected: 'root', message: npmMessage, state: 'violation' };
    }
    const remote = getByPath(config, ['allow-remote']);
    if (!isRootOrNone(remote)) {
      return { actual: remote, expected: 'root', message: npmMessage, state: 'violation' };
    }
    return { state: 'ok' };
  },
  docs: 'https://docs.npmjs.com/cli/v11/using-npm/config#allow-git',
  file: npmrc,
  fix() {
    return [
      { file: npmrc, keyPath: ['allow-git'], op: 'setKey', value: 'root' },
      { file: npmrc, keyPath: ['allow-remote'], op: 'setKey', value: 'root' },
    ];
  },
  fixKind: 'auto',
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
      versionNote: { configAvailableSince: 'pnpm 10.26.0' },
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
