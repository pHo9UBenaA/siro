import { isRecord } from '../../shared/records.ts';

export const CODEC_KINDS = ['json', 'npmrc', 'toml', 'yaml'] as const;
export type CodecKind = (typeof CODEC_KINDS)[number];

/** Scalar value that can be written back to a config file. */
export type ConfigValue = string | number | boolean;

/** Scalar value as it appears when reading (codecs may produce `null`). */
export type ConfigScalar = ConfigValue | null;

/** Parsed keys are unvalidated; each rule narrows the values it reads. */
export interface ParsedConfig {
  readonly [key: string]: unknown;
}

/** A (possibly nested) key path, guaranteed to have at least one segment. */
export type KeyPath = readonly [string, ...string[]];

/** A single key to set. */
export interface KeyAssignment {
  readonly keyPath: KeyPath;
  readonly value: ConfigValue;
}

/** Parser values may include nested arrays and TOML dates. */
export type ConfigReadValue = unknown;

/**
 * Look up a nested value by key path; `undefined` if any segment is missing.
 *
 * Part of the public surface (re-exported from `src/index.ts`): embedders
 * writing custom rules receive the same `config: ParsedConfig` shape that
 * built-in rules see, so they need the canonical traversal helper rather
 * than re-implementing `null`-vs-missing semantics per rule.
 */
export const getByPath = (config: ParsedConfig, keyPath: KeyPath): ConfigReadValue => {
  let current: unknown = config;
  for (const key of keyPath) {
    if (!isRecord(current)) {
      return;
    }
    if (!Object.hasOwn(current, key)) {
      return;
    }
    current = current[key];
  }
  return current;
};

/** Accept only mapping roots while preserving unvalidated values inside them. */
export const toParsedConfig = (value: unknown): ParsedConfig => {
  if (isRecord(value)) {
    return value;
  }
  throw new TypeError('Config root must be a mapping.');
};
