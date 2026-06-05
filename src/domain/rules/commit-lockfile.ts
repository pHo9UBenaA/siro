import type { AdvisoryRuleBinding, Rule } from '../entities/rule.ts';
import { type PMSignals, PM_SIGNALS } from '../entities/signals.ts';
import type { PM } from '../entities/pms.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { asRelPath } from '../../shared/paths.ts';

const LOCKFILE_DOCS: Partial<Record<PM, string>> = {
  aube: 'https://aube.en.dev/package-manager/lockfiles',
  bun: 'https://bun.com/docs/install/lockfile',
  deno: 'https://docs.deno.com/runtime/fundamentals/modules/#integrity-checking-and-lock-files',
  npm: 'https://docs.npmjs.com/cli/v11/configuring-npm/package-lock-json',
  pnpm: 'https://pnpm.io/git#lockfiles',
  yarn: 'https://yarnpkg.com/getting-started/qa#should-lockfiles-be-committed-to-the-repository',
};

const lockfileBinding = (pm: PM): AdvisoryRuleBinding => {
  const { lockfiles, reusesLockfiles }: PMSignals = PM_SIGNALS[pm];
  const [primary] = lockfiles;
  // fileGlob refs aren't in CONFIG_FILES (the lockfile name is PM-derived), so
  // mint the RelPath here — the one spot this rule crosses into a ConfigFileRef.
  const primaryRef = { kind: 'fileGlob', path: asRelPath(primary) } as const;
  // A committed lockfile of any shape this PM writes OR reuses satisfies the
  // rule — aube, for instance, is happy with a pre-existing pnpm-lock.yaml.
  const accepted = [...lockfiles, ...(reusesLockfiles ?? [])];
  return {
    check(ctx: RepoContext) {
      if (accepted.some((lf) => ctx.exists(asRelPath(lf)))) {
        return { state: 'ok' };
      }
      return { message: `No lockfile found. Generate and commit ${primary}.`, state: 'violation' };
    },
    docs: LOCKFILE_DOCS[pm],
    file: primaryRef,
    fix() {
      return [
        {
          file: primaryRef,
          message: `Install dependencies to generate ${primary}, then commit it.`,
          op: 'ensureFileTracked',
        },
      ];
    },
    fixKind: 'advisory',
  };
};

export const commitLockfile: Rule = {
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
};
