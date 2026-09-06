import { type PM, PMS, parsePackageManagerField } from '../entities/pms.ts';
import { PM_SIGNALS } from '../entities/signals.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { asRelPath } from '../../shared/paths.ts';

// Reused lockfiles do not identify their consuming manager. Owned signals must be unique.
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

export const detectPMs = (ctx: RepoContext): PM[] => {
  const found = new Set<PM>();
  const declared = ctx.packageJson?.packageManager;
  const declaredPM = declared === undefined ? undefined : parsePackageManagerField(declared);
  if (declaredPM !== undefined) {
    found.add(declaredPM);
  }
  for (const pm of PMS) {
    const signals = DETECTION_SIGNALS.get(pm);
    if (signals && signals.some((file) => ctx.exists(asRelPath(file)))) {
      found.add(pm);
    }
  }
  return PMS.filter((pm) => found.has(pm));
};
