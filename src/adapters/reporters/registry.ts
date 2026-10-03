import { type Reporter } from '../../core/contracts/reporter.ts';
import { githubReporter } from './github.ts';
import { jsonReporter } from './json.ts';
import { prettyReporter } from './pretty.ts';

const BUILTINS = [
  prettyReporter,
  jsonReporter,
  githubReporter,
] as const satisfies readonly Reporter<BuiltinReporterName>[];

export const DEFAULT_REPORTER_NAME = prettyReporter.name;
export const JSON_REPORTER_NAME = jsonReporter.name;

/** Names of every built-in reporter, in stable display order. */
export const BUILTIN_REPORTER_NAMES: readonly BuiltinReporterName[] = BUILTINS.map(
  (reporter) => reporter.name,
);

/** Literal union of every built-in reporter name. */
export type BuiltinReporterName = (
  | typeof prettyReporter
  | typeof jsonReporter
  | typeof githubReporter
)['name'];

/** Later registrations replace earlier reporters with the same name. */
export const createRegistry = (extras: readonly Reporter[] = []): ReadonlyMap<string, Reporter> => {
  const registry = new Map<string, Reporter>();
  for (const reporter of BUILTINS) registry.set(reporter.name, reporter);
  for (const reporter of extras) registry.set(reporter.name, reporter);
  return registry;
};

export { githubReporter, jsonReporter, prettyReporter };
