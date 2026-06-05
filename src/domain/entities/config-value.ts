export type CodecKind = 'npmrc' | 'yaml' | 'toml' | 'json';

/** Scalar value that can be written back to a config file. */
export type ConfigValue = string | number | boolean;

/** Scalar value as it appears when reading (codecs may produce `null`). */
export type ConfigScalar = ConfigValue | null;

/** Recursive, structurally typed view of a parsed config file. */
export interface ParsedConfig {
  readonly [key: string]: ConfigScalar | readonly ConfigScalar[] | ParsedConfig;
}

/** A (possibly nested) key path, guaranteed to have at least one segment. */
export type KeyPath = readonly [string, ...string[]];

/** A single key to set. */
export interface KeyAssignment {
  readonly keyPath: KeyPath;
  readonly value: ConfigValue;
}

/**
 * Value a rule's `check` saw at the target key, as returned by `getByPath`.
 * Runtime caveat: YAML/TOML parsers can yield host values (e.g. `Date`)
 * nested inside `ParsedConfig` even though the type does not name them —
 * compare timestamps by `valueOf()`, not by type narrowing on this union.
 */
export type ConfigReadValue = ConfigScalar | readonly ConfigScalar[] | ParsedConfig | undefined;

const isParsedConfigObject = (value: unknown): value is ParsedConfig => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  // Plain object check: only `{}` and `Object.create(null)` count as a
  // config root. Date / Map / Set / RegExp / class instances all satisfy
  // `typeof === 'object'` but their enumerable keys aren't meaningful as
  // config — letting them through would expose `getTime`-style noise to
  // `getByPath` and obscure the real "root must be a mapping" contract.
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
};

/**
 * Look up a nested value by key path; `undefined` if any segment is missing.
 *
 * Part of the public surface (re-exported from `src/index.ts`): embedders
 * writing custom rules receive the same `config: ParsedConfig` shape that
 * built-in rules see, so they need the canonical traversal helper rather
 * than re-implementing `null`-vs-missing semantics per rule.
 */
export const getByPath = (
  config: ParsedConfig,
  keyPath: KeyPath,
): ConfigScalar | readonly ConfigScalar[] | ParsedConfig | undefined => {
  let current: ConfigScalar | readonly ConfigScalar[] | ParsedConfig | undefined = config;
  for (const key of keyPath) {
    if (!isParsedConfigObject(current)) {
      return;
    }
    current = current[key];
  }
  return current;
};

/**
 * Single trust boundary between an external parser and siro's types — the
 * `as ParsedConfig` cast lives here only, after a runtime shape check.
 * Casting in each codec would scatter the boundary and let runtime checks
 * drift out of sync. A deep sanitiser (recursing to keep only known scalars)
 * was rejected because YAML legitimately yields `Date` and other host values
 * that rules can inspect — silently dropping them would look like missing
 * config keys. Throwing on non-objects was rejected so a root-level array or
 * scalar behaves the same as an empty file: `{}`, letting `getByPath` return
 * `undefined` instead of crashing every rule.
 */
export const toParsedConfig = (value: unknown): ParsedConfig => {
  if (isParsedConfigObject(value)) {
    return value;
  }
  return {};
};
