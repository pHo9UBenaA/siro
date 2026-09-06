import { type Reporter } from '../../domain/ports/reporter.ts';
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

/** Later registrations replace earlier reporters with the same name. */
export const createRegistry = (extras: readonly Reporter[] = []): ReadonlyMap<string, Reporter> =>
  new Map([...BUILTINS, ...extras].map((reporter) => [reporter.name, reporter]));

export { githubReporter, jsonReporter, prettyReporter };
