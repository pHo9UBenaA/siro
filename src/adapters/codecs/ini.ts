import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';
import ini from 'ini';

const INTEGER_PATTERN = /^-?\d+$/u;

const parseBooleanString = (text: string): boolean | undefined => {
  if (text === 'true') return true;
  if (text === 'false') return false;
  return undefined;
};

const parseIntegerString = (text: string): number | undefined => {
  if (INTEGER_PATTERN.test(text)) return Number(text);
  return undefined;
};

const coerceIniScalar = (raw: unknown): unknown => {
  if (typeof raw !== 'string') return raw;
  return parseBooleanString(raw) ?? parseIntegerString(raw) ?? raw;
};

/**
 * Coerce decoded scalars to npm booleans/integers, including originally quoted
 * strings: ini.parse no longer preserves their quoting. Use YAML/JSON for custom
 * rules that need to distinguish a string like "0" from a number.
 */
export const iniCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    const raw = toParsedConfig(ini.parse(text));
    const config: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) {
        // `key[]=v` npmrc syntax parses to an array. Preserve it, coercing
        // each element like a top-level scalar.
        config[key] = value.map(coerceIniScalar);
      } else if (typeof value === 'object' && value !== null) {
        config[key] = toParsedConfig(value);
      } else {
        config[key] = coerceIniScalar(value);
      }
    }
    return config;
  },
};
