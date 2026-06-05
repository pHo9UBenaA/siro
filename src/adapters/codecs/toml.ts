import { type ParsedConfig, toParsedConfig } from '../../domain/entities/config-value.ts';
import type { ConfigCodec } from '../../domain/ports/config-codec.ts';
import { parse as parseToml } from 'smol-toml';

export const tomlCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    if (text.trim() === '') {
      return {};
    }
    return toParsedConfig(parseToml(text));
  },
};
