import { type PM, PMS } from '../entities/pms.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { UsageError } from '../../shared/errors.ts';
import { detectPMs } from './detect-pms.ts';

export interface ResolvePMsOptions {
  /** A single PM forced by `--pm`; bypasses auto-detection when set. */
  readonly pmOverride?: PM;
  /** User's `siro.config.ts` `pms` allow-list; intersected with the detection. */
  readonly allowed?: readonly PM[];
}

const throwEmptyPMsError = (
  detected: readonly PM[],
  opts: ResolvePMsOptions,
  allowed: readonly PM[] | undefined,
): never => {
  if (allowed) {
    if (opts.pmOverride) {
      // The PM was forced via --pm, not detected — don't mislabel it "Detected".
      throw new UsageError(
        `--pm ${opts.pmOverride} is not in siro.config.ts pms (${allowed.join(', ')}). Adjust the config or the flag.`,
      );
    }
    const EMPTY = 0;
    let msg = `No package manager detected, and siro.config.ts restricts pms to ${allowed.join(', ')}. Adjust the config or remove the restriction.`;
    if (detected.length > EMPTY) {
      msg = `Detected PMs (${detected.join(', ')}) do not match siro.config.ts pms (${allowed.join(', ')}). Adjust the config or remove the restriction.`;
    }
    throw new UsageError(msg);
  }
  throw new UsageError(`No package manager detected. Pass --pm <${PMS.join('|')}> to be explicit.`);
};

/**
 * Pick the set of PMs to operate on for a single CLI command, applying the
 * same three-stage policy (`override → detect → restrict`) that `lint`
 * needs. Throws `UsageError` for the two empty-set cases so the
 * caller never has to invent its own messaging.
 *
 * Empty-set branches are usage errors, not silent npm fallback: see DECISIONS.md D08.
 */
const computePMs = (
  ctx: RepoContext,
  opts: ResolvePMsOptions,
): { detected: readonly PM[]; pms: readonly PM[] } => {
  // `detectPMs` returns canonical `PMS` order by construction; an override
  // is a single element, so trivially ordered. `.filter` on `detected`
  // preserves that order — no extra sort needed downstream.
  let detected: readonly PM[] = detectPMs(ctx);
  if (opts.pmOverride) {
    detected = [opts.pmOverride];
  }
  const { allowed } = opts;
  let pms: readonly PM[] = detected;
  if (allowed) {
    const allowedSet = new Set(allowed);
    pms = detected.filter((pm) => allowedSet.has(pm));
  }
  return { detected, pms };
};

export const resolvePMs = (ctx: RepoContext, opts: ResolvePMsOptions): readonly PM[] => {
  const { detected, pms } = computePMs(ctx, opts);
  const EMPTY = 0;
  if (pms.length > EMPTY) {
    return pms;
  }
  throw throwEmptyPMsError(detected, opts, opts.allowed);
};
