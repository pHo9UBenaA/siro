import { ConfigError } from '../../shared/errors.ts';
import type { Rule } from '../entities/rule.ts';

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

const throwCollisionError = (collisions: ReadonlySet<string>): never => {
  const ids = [...collisions];
  const noun = ids.length === 1 ? 'rule id collides' : 'rule ids collide';
  throw new ConfigError(
    `customRules: ${noun} with builtin, config, or another programmatic rule: ${ids.map((id) => `'${id}'`).join(', ')}. Pick a unique id (or use 'rules' to override an existing rule's severity).`,
  );
};

export const mergeProgrammaticRules = (
  builtins: readonly Rule[],
  programmatic?: readonly Rule[],
  configCustom?: readonly Rule[],
): readonly Rule[] => {
  const additions = programmatic ?? [];
  const taken = new Set<string>([
    ...builtins.map((rule) => rule.id),
    ...(configCustom ?? []).map((rule) => rule.id),
  ]);
  const collisions = detectCollisions(additions, taken);
  if (collisions.size > 0) {
    throwCollisionError(collisions);
  }
  return [...builtins, ...additions];
};
