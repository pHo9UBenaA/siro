import { type ParsedConfig, toParsedConfig } from '../../domain/entities/config-value.ts';
import type { ConfigCodec } from '../../domain/ports/config-codec.ts';
import ini from 'ini';

const INTEGER_PATTERN = /^-?\d+$/u;

const coerceBoolean = (str: string): boolean | undefined => {
  if (str === 'true') {
    return true;
  }
  if (str === 'false') {
    return false;
  }
  return void 0;
};

const coerceInteger = (str: string): number | undefined => {
  if (INTEGER_PATTERN.test(str)) {
    return Number(str);
  }
  return void 0;
};

const coerce = (raw: unknown): unknown => {
  if (typeof raw !== 'string') {
    return raw;
  }
  return coerceBoolean(raw) ?? coerceInteger(raw) ?? raw;
};

/**
 * Coerces unquoted scalars on read so rule checks can match by typed
 * value (`true === true`, `7 === 7`). Strings whose lexeme matches
 * `true`/`false`/`-?\d+` lose their string-ness — this is by design for
 * the npm schema, where rule values are booleans / integers / the empty
 * string. Don't model a customRule around a string like `"0"` on this
 * codec; pick yaml/json if you need lossless arbitrary-string reads.
 */
export const iniCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    const raw = toParsedConfig(ini.parse(text));
    const config: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (Array.isArray(value)) {
        // `key[]=v` npmrc syntax parses to an array. Preserve it, coercing
        // each element like a top-level scalar.
        config[key] = value.map((elem) => coerce(elem));
      } else if (typeof value === 'object' && value !== null) {
        config[key] = toParsedConfig(value);
      } else {
        config[key] = coerce(value);
      }
    }
    return config;
  },
};
