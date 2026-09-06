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

/** Apply the explicit selection or detection, then the configured allow-list. */
export const resolvePMs = (ctx: RepoContext, opts: ResolvePMsOptions): readonly PM[] => {
  const { pmOverride, allowed } = opts;
  const detected = pmOverride ? [pmOverride] : detectPMs(ctx);
  const pms = allowed ? detected.filter((pm) => allowed.includes(pm)) : detected;
  if (pms.length > 0) {
    return pms;
  }
  if (!allowed) {
    throw new UsageError(
      `No package manager detected. Pass --pm <${PMS.join('|')}> to be explicit.`,
    );
  }
  if (pmOverride) {
    throw new UsageError(
      `--pm ${pmOverride} is not in siro.config.ts pms (${allowed.join(', ')}). Adjust the config or the flag.`,
    );
  }
  if (detected.length > 0) {
    throw new UsageError(
      `Detected PMs (${detected.join(', ')}) do not match siro.config.ts pms (${allowed.join(', ')}). Adjust the config or remove the restriction.`,
    );
  }
  throw new UsageError(
    `No package manager detected, and siro.config.ts restricts pms to ${allowed.join(', ')}. Adjust the config or remove the restriction.`,
  );
};
