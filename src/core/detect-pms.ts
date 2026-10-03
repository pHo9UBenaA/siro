import { type PM, PMS, parsePackageManagerField } from './contracts/pms.ts';
import { PM_SIGNALS } from './signals.ts';
import type { RepoContext } from './contracts/repo-context.ts';
import { asRelPath } from './contracts/paths.ts';

// Reused lockfiles do not identify their consuming manager. Owned signals must be unique.
const registerSignals = (
  signals: readonly string[],
  pm: PM,
  ownersByFile: Map<string, PM>,
): void => {
  for (const file of signals) {
    const prior = ownersByFile.get(file);
    if (typeof prior !== 'undefined') {
      throw new TypeError(`detection signal '${file}' is claimed by both '${prior}' and '${pm}'`);
    }
    ownersByFile.set(file, pm);
  }
};

const buildDetectionSignals = (): ReadonlyMap<PM, readonly string[]> => {
  const signalsByPM = new Map<PM, readonly string[]>();
  const ownersByFile = new Map<string, PM>();
  for (const pm of PMS) {
    const { lockfiles, configs } = PM_SIGNALS[pm];
    const signals = [...lockfiles, ...configs];
    registerSignals(signals, pm, ownersByFile);
    signalsByPM.set(pm, signals);
  }
  return signalsByPM;
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
