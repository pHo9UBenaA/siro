import { type RuleBinding, type VersionNote, defineRule } from '../entities/rule.ts';
import { type PMSignals, PM_SIGNALS } from '../entities/signals.ts';
import type { PM } from '../entities/pms.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { asRelPath } from '../../shared/paths.ts';

const LOCKFILE_DOCS: Partial<Record<PM, string>> = {
  aube: 'https://aube.en.dev/package-manager/lockfiles',
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

export const commitLockfile = defineRule({
  bindings: {
    aube: lockfileBinding('aube'),
    bun: lockfileBinding('bun'),
    deno: lockfileBinding('deno'),
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
