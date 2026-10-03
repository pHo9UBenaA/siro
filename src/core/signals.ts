import { CONFIG_FILES } from './config-files.ts';
import type { PM } from './contracts/pms.ts';

/**
 * Owned lockfiles and configs are PM detection evidence. The first lockfile is
 * preferred in guidance. Reused foreign lockfiles satisfy policy but never
 * identify a PM, or an ordinary npm/pnpm repository would be detected as Aube.
 */
export interface PMSignals {
  readonly lockfiles: readonly [string, ...string[]];
  readonly configs: readonly string[];
  /** Other PMs' lockfiles this PM reuses; satisfies commit-lockfile, not detection. */
  readonly reusesLockfiles?: readonly string[];
}

export const PM_SIGNALS = {
  aube: {
    // https://github.com/aubepkg/aube/blob/main/docs/package-manager/lockfiles.md
    configs: [CONFIG_FILES.aubeWorkspace.path],
    lockfiles: ['aube-lock.yaml'],
    reusesLockfiles: [
      'pnpm-lock.yaml',
      'package-lock.json',
      'npm-shrinkwrap.json',
      'yarn.lock',
      'bun.lock',
    ],
  },
  bun: { configs: [CONFIG_FILES.bunfig.path], lockfiles: ['bun.lock', 'bun.lockb'] },
  deno: { configs: [CONFIG_FILES.denoJson.path, 'deno.jsonc'], lockfiles: ['deno.lock'] },
  npm: { configs: [], lockfiles: ['package-lock.json', 'npm-shrinkwrap.json'] },
  pnpm: { configs: [CONFIG_FILES.pnpmWorkspace.path], lockfiles: ['pnpm-lock.yaml'] },
  yarn: { configs: [CONFIG_FILES.yarnrc.path], lockfiles: ['yarn.lock'] },
} as const satisfies Record<PM, PMSignals>;
