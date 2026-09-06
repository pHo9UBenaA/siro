import { CONFIG_FILES } from '../entities/config-files.ts';
import { getByPath } from '../entities/config-value.ts';
import { type RuleBinding, type VersionNote, defineRule } from '../entities/rule.ts';
import { type PMSignals, PM_SIGNALS } from '../entities/signals.ts';
import type { PM } from '../entities/pms.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { asRelPath, isRelPath } from '../../shared/paths.ts';
import { isPlainRecord } from '../../shared/records.ts';

const LOCKFILE_DOCS: Partial<Record<PM, string>> = {
  aube: 'https://github.com/aubepkg/aube/blob/main/docs/package-manager/lockfiles.md',
  bun: 'https://bun.com/docs/install/lockfile',
  deno: 'https://docs.deno.com/runtime/fundamentals/modules/#integrity-checking-and-lock-files',
  npm: 'https://docs.npmjs.com/cli/v12/configuring-npm/package-lock-json',
  pnpm: 'https://pnpm.io/git#lockfiles',
  yarn: 'https://yarnpkg.com/getting-started/qa#should-lockfiles-be-committed-to-the-repository',
};

const LOCKFILE_VERSION_NOTES: Partial<Record<PM, VersionNote>> = {
  deno: { configAvailableSince: 'deno 1.28.0' },
};

const lockfileBinding = (pm: PM): RuleBinding => {
  const { lockfiles, reusesLockfiles }: PMSignals = PM_SIGNALS[pm];
  const [primary] = lockfiles;
  // npm-shrinkwrap.json still identifies npm, but npm 12 no longer reads it.
  const accepted = [...lockfiles, ...(reusesLockfiles ?? [])].filter(
    (lockfile) => pm !== 'npm' || lockfile === primary,
  );
  return {
    check(ctx: RepoContext) {
      if (
        pm === 'aube' &&
        ctx.exists(asRelPath('bun.lockb')) &&
        !ctx.exists(asRelPath('bun.lock'))
      ) {
        return {
          state: 'violation',
          message: 'Aube cannot read bun.lockb, even when another lockfile exists.',
          remediation: {
            kind: 'manual',
            steps: ['Run `bun install --save-text-lockfile` to generate bun.lock, then commit it.'],
          },
        };
      }
      if (accepted.some((lf) => ctx.exists(asRelPath(lf)))) {
        return { state: 'ok' };
      }
      return {
        remediation: {
          kind: 'manual',
          steps: [`Install dependencies to generate ${primary}, then commit it.`],
        },
        message: `No lockfile found. Generate and commit ${primary}.`,
        state: 'violation',
      };
    },
    docs: LOCKFILE_DOCS[pm],
    versionNote: LOCKFILE_VERSION_NOTES[pm],
  };
};

const denoBinding: RuleBinding = {
  file: CONFIG_FILES.denoJson,
  docs: LOCKFILE_DOCS.deno,
  versionNote: LOCKFILE_VERSION_NOTES.deno,
  check(ctx, config) {
    const lock = getByPath(config, ['lock']);
    if (
      lock != null &&
      typeof lock !== 'boolean' &&
      typeof lock !== 'string' &&
      !(
        isPlainRecord(lock) &&
        (lock.path == null || typeof lock.path === 'string') &&
        (lock.frozen == null || typeof lock.frozen === 'boolean')
      )
    ) {
      return {
        state: 'violation',
        message: 'Invalid Deno lock setting.',
        remediation: {
          kind: 'manual',
          steps: [
            'Use a boolean, a lockfile path, or an object with optional path and frozen fields.',
          ],
        },
      };
    }
    const selected = typeof lock === 'string' ? lock : getByPath(config, ['lock', 'path']);
    const lockPath = selected == null ? asRelPath('deno.lock') : selected;
    if (lock !== false && isRelPath(lockPath) && ctx.exists(lockPath)) return { state: 'ok' };
    return {
      state: 'violation',
      message:
        lock === false
          ? 'Enable the Deno lockfile; `lock: false` disables it even when deno.lock exists.'
          : `No readable project lockfile found at ${String(lockPath)}.`,
      remediation: {
        kind: 'manual',
        steps: [
          'Enable lockfile use in deno.json and generate and commit the configured lockfile within the project.',
        ],
      },
    };
  },
};

export const commitLockfile = defineRule({
  bindings: {
    aube: lockfileBinding('aube'),
    bun: lockfileBinding('bun'),
    deno: denoBinding,
    npm: lockfileBinding('npm'),
    pnpm: lockfileBinding('pnpm'),
    yarn: lockfileBinding('yarn'),
  },
  description:
    'Lockfiles pin the full dependency tree and integrity hashes, enabling reproducible, verifiable installs (e.g. `npm ci`).',
  docs: 'https://github.com/bodadotsh/npm-security-best-practices#2-include-lockfiles',
  id: 'commit-lockfile',
  severity: 'error',
  title: 'Commit a lockfile',
});
