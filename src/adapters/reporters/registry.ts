import { type Reporter, isReporterShape } from '../../domain/ports/reporter.ts';
import { githubReporter } from './github.ts';
import { jsonReporter } from './json.ts';
import { prettyReporter } from './pretty.ts';

const BUILTINS = [
  prettyReporter,
  jsonReporter,
  githubReporter,
] as const satisfies readonly Reporter[];

export const DEFAULT_REPORTER_NAME = prettyReporter.name;
export const JSON_REPORTER_NAME = jsonReporter.name;

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
