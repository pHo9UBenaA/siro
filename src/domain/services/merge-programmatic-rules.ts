import { ConfigError } from '../../shared/errors.ts';
import type { Rule } from '../entities/rule.ts';

/**
 * Compose builtin rules with embedder-supplied programmatic rules. Reject
 * any programmatic rule whose id collides with a builtin, a config-supplied
 * customRule, or another programmatic rule in the same call — embedders need
 * to hear about collisions explicitly, the same way loadConfig surfaces
 * intra-config duplicates (otherwise two rules with the same id race through
 * applyConfig and double-count findings).
 */
const detectCollisions = (
  programmatic: readonly Rule[],
  taken: ReadonlySet<string>,
): ReadonlySet<string> => {
  const seen = new Set<string>();
  const collisions = new Set<string>();
  for (const rule of programmatic) {
    if (taken.has(rule.id) || seen.has(rule.id)) {
      collisions.add(rule.id);
    }
    seen.add(rule.id);
  }
  return collisions;
};

const SINGLE_COLLISION = 1;

const throwCollisionError = (collisions: ReadonlySet<string>): never => {
  const ids = [...collisions];
  let noun = 'rule id collides';
  if (ids.length > SINGLE_COLLISION) {
    noun = 'rule ids collide';
  }
  throw new ConfigError(
    `customRules: ${noun} with builtin, config, or another programmatic rule: ${ids.map((id) => `'${id}'`).join(', ')}. Pick a unique id (or use 'rules' to override an existing rule's severity).`,
  );
};

export const mergeProgrammaticRules = (
  builtins: readonly Rule[],
  programmatic?: readonly Rule[],
  configCustom?: readonly Rule[],
): readonly Rule[] => {
  // configCustom is merged downstream by applyConfig, so this helper only
  // appends programmatic rules (after a collision check that includes
  // configCustom in the `taken` set). Merging configCustom here as well
  // would double the customRules in the final ruleset.
  const EMPTY = 0;
  if (typeof programmatic === 'undefined' || programmatic.length === EMPTY) {
    return builtins;
  }
  const taken = new Set<string>([
    ...builtins.map((rule) => rule.id),
    ...(configCustom ?? []).map((rule) => rule.id),
  ]);
  const collisions = detectCollisions(programmatic, taken);
  if (collisions.size > EMPTY) {
    throwCollisionError(collisions);
  }
  return [...builtins, ...programmatic];
};
