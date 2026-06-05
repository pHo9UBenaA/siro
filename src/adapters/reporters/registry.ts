import { type Reporter, isReporterShape } from '../../domain/ports/reporter.ts';
import { githubReporter } from './github.ts';
import { jsonReporter } from './json.ts';
import { prettyReporter } from './pretty.ts';

// SSOT for builtin reporters. The tuple drives the registry, the literal
// name union, and the help-text list — there's no separate "default"
// registry that could drift from the names in this file. The
// `satisfies` clause guarantees every entry is a real Reporter, catching
// a future-rename or accidental nullish at compile time.
const BUILTINS = [
  prettyReporter,
  jsonReporter,
  githubReporter,
] as const satisfies readonly Reporter[];

/** Names of every built-in reporter, in stable display order. */
export const BUILTIN_REPORTER_NAMES: readonly BuiltinReporterName[] = BUILTINS.map(
  (rep) => rep.name,
);

/** Literal union of every built-in reporter name. */
export type BuiltinReporterName = (typeof BUILTINS)[number]['name'];

/** Reporter lookup table — pass an explicit value to keep calls hermetic. */
export interface ReporterRegistry {
  get: (name: string) => Reporter | undefined;
  list: () => readonly string[];
}

/** Build a registry from the builtins plus any extras (later wins on collision). */
export const createRegistry = (extras: readonly Reporter[] = []): ReporterRegistry => {
  const map = new Map<string, Reporter>();
  for (const rep of [...BUILTINS, ...extras]) {
    // createRegistry is part of the public API (index.ts), so this is a genuine
    // trust boundary for embedders calling it directly — the shape check here
    // does not violate the no-internal-revalidation rule.
    if (!isReporterShape(rep)) {
      throw new TypeError(
        "createRegistry: each reporter needs a string 'name' and a 'format' function.",
      );
    }
    map.set(rep.name, rep);
  }
  return {
    get: (name) => map.get(name),
    list: () => [...map.keys()],
  };
};

export { githubReporter, jsonReporter, prettyReporter };
