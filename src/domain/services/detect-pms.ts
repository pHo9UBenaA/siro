import { type PM, PMS, parsePackageManagerField } from '../entities/pms.ts';
import { PM_SIGNALS } from '../entities/signals.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { asRelPath } from '../../shared/paths.ts';

/**
 * Per-PM list of filenames whose presence identifies that PM: its own
 * `lockfiles` plus `configs`. `reusesLockfiles` is deliberately excluded —
 * those are other PMs' shapes (see PMSignals), so they must not count as
 * detection evidence. With reused lockfiles split out, every detection signal
 * is owned by exactly one PM; the IIFE asserts that invariant at module load
 * so a future signal collision fails loudly here rather than silently
 * mis-attributing a file.
 */
const registerSignals = (signals: readonly string[], pm: PM, owner: Map<string, PM>): void => {
  for (const file of signals) {
    const prior = owner.get(file);
    if (typeof prior !== 'undefined') {
      throw new TypeError(`detection signal '${file}' is claimed by both '${prior}' and '${pm}'`);
    }
    owner.set(file, pm);
  }
};

const buildDetectionSignals = (): ReadonlyMap<PM, readonly string[]> => {
  const out = new Map<PM, readonly string[]>();
  const owner = new Map<string, PM>();
  for (const pm of PMS) {
    const { lockfiles, configs } = PM_SIGNALS[pm];
    const signals = [...lockfiles, ...configs];
    registerSignals(signals, pm, owner);
    out.set(pm, signals);
  }
  return out;
};

const DETECTION_SIGNALS: ReadonlyMap<PM, readonly string[]> = buildDetectionSignals();

/**
 * Detect the package managers in use, strongest signal first:
 *   1) `packageManager` in package.json,
 *   2) lockfiles + configs (see DETECTION_SIGNALS for the per-PM allow-list
 *      that skips filenames shared between PMs).
 * Returns every PM with evidence, in canonical `PMS` order. `ctx` carries
 * the repo signals — `packageJson` (already parsed) and `exists(relPath)`
 * for filename probing — so embedders can swap in a virtual FS without
 * touching the real disk.
 */
const addDeclaredPM = (ctx: RepoContext, found: Set<PM>): void => {
  let declared: string | undefined = void 0;
  if (ctx.packageJson) {
    declared = ctx.packageJson.packageManager;
  }
  if (typeof declared === 'string') {
    const pm = parsePackageManagerField(declared);
    if (typeof pm !== 'undefined') {
      found.add(pm);
    }
  }
};

export const detectPMs = (ctx: RepoContext): PM[] => {
  const found = new Set<PM>();
  addDeclaredPM(ctx, found);
  for (const pm of PMS) {
    const signals = DETECTION_SIGNALS.get(pm);
    if (signals && signals.some((file) => ctx.exists(asRelPath(file)))) {
      found.add(pm);
    }
  }
  return PMS.filter((pm) => found.has(pm));
};
