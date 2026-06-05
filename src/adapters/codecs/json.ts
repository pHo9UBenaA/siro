import { type ParsedConfig, toParsedConfig } from '../../domain/entities/config-value.ts';
import type { ConfigCodec } from '../../domain/ports/config-codec.ts';

/** Codec for strict JSON (deno.json, package.json). Comments are not supported. */
export const jsonCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    const trimmed = text.trim();
    if (trimmed === '') {
      return {};
    }
    return toParsedConfig(JSON.parse(trimmed));
  },
};
