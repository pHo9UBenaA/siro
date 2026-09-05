import { isPlainRecord } from '../../shared/records.ts';

export const CODEC_KINDS = ['json', 'npmrc', 'toml', 'yaml'] as const;
export type CodecKind = (typeof CODEC_KINDS)[number];

/** Scalar value that can be written back to a config file. */
export type ConfigValue = string | number | boolean;

/** Parsed keys are unvalidated; each rule narrows the values it reads. */
export interface ParsedConfig {
  readonly [key: string]: unknown;
}

/** A (possibly nested) key path, guaranteed to have at least one segment. */
export type KeyPath = readonly [string, ...string[]];

/** Parser values may include nested arrays and TOML dates. */
export type ConfigReadValue = unknown;

/** Read an own key path; absent or non-mapping parents yield undefined. */
export const getByPath = (config: ParsedConfig, keyPath: KeyPath): ConfigReadValue => {
  let current: unknown = config;
  for (const key of keyPath) {
    if (!isPlainRecord(current)) {
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
  if (isPlainRecord(value)) {
    return value;
  }
  throw new TypeError('Config root must be a mapping.');
};
