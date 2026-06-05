import { CONFIG_FILES } from './config-files.ts';
import type { PM } from './pms.ts';

/**
 * Filenames that identify a package manager. `lockfiles[0]` is the
 * canonical/preferred one (used by lint messages and error
 * messages); the rest are legacy/alternative forms the PM writes itself.
 *
 * `lockfiles` and `configs` are **detection evidence** — their presence means
 * the PM is in use. `reusesLockfiles` is NOT evidence: it lists other PMs'
 * lockfile shapes that this PM will reuse rather than writing its own (aube),
 * so `commit-lockfile` accepts them but `detectPMs` ignores them — otherwise a
 * plain pnpm/npm repo would false-positive as aube. Keeping the two lists
 * separate is what lets detection stay a simple "any signal present?" check.
 */
export interface PMSignals {
  readonly lockfiles: readonly [string, ...string[]];
  readonly configs: readonly string[];
  /** Other PMs' lockfiles this PM reuses; satisfies commit-lockfile, not detection. */
  readonly reusesLockfiles?: readonly string[];
}

export const PM_SIGNALS = {
  aube: {
    // https://aube.en.dev/package-manager/lockfiles
    configs: [CONFIG_FILES.aubeWorkspace.path],
    lockfiles: ['aube-lock.yaml'],
    reusesLockfiles: [
      'pnpm-lock.yaml',
      'package-lock.json',
      'npm-shrinkwrap.json',
      'yarn.lock',
      'bun.lock',
      'bun.lockb',
      'deno.lock',
    ],
  },
  bun: { configs: [CONFIG_FILES.bunfig.path], lockfiles: ['bun.lock', 'bun.lockb'] },
  deno: { configs: [CONFIG_FILES.denoJson.path], lockfiles: ['deno.lock'] },
  npm: { configs: [], lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'] },
  pnpm: { configs: [CONFIG_FILES.pnpmWorkspace.path], lockfiles: ['pnpm-lock.yaml'] },
  yarn: { configs: [CONFIG_FILES.yarnrc.path], lockfiles: ['yarn.lock'] },
} as const satisfies Record<PM, PMSignals>;
