import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';
import { ConfigParseError } from '../../core/contracts/errors.ts';
import { checkConfigDepth, DEFAULT_SCAN_LIMITS } from '../../core/contracts/scan-limits.ts';

// Runtime SyntaxError messages may disclose arbitrary source bytes.
const decodeJson = (text: string): unknown => {
  try {
    return JSON.parse(text.trim());
  } catch {
    throw new ConfigParseError('invalid JSON');
  }
};

/** Strict JSON with bounded configuration nesting. */
export const parseJson = (text: string, maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth): unknown => {
  const value = decodeJson(text);
  checkConfigDepth(value, maxDepth);
  return value;
};
export const jsonCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    return toParsedConfig(parseJson(text));
  },
};
