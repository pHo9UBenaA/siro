import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';
import { ConfigParseError } from '../../core/contracts/errors.ts';
import { checkConfigDepth, DEFAULT_SCAN_LIMITS } from '../../core/contracts/scan-limits.ts';

/** Strict JSON; runtime SyntaxError messages may disclose arbitrary source bytes. */
export const parseJson = (text: string, maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth): unknown => {
  let value: unknown;
  try {
    value = JSON.parse(text.trim());
  } catch {
    throw new ConfigParseError('invalid JSON');
  }
  checkConfigDepth(value, maxDepth);
  return value;
};
export const jsonCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    return toParsedConfig(parseJson(text));
  },
};
