import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';

/** Codec for strict JSON (deno.json, package.json). Comments are not supported. */
export const jsonCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    const trimmed = text.trim();
    return toParsedConfig(JSON.parse(trimmed));
  },
};
