import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';
import { parse as parseToml } from 'smol-toml';

export const tomlCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    if (text.trim() === '') {
      return {};
    }
    const input = text.startsWith('\uFEFF') ? text.slice(1) : text;
    return toParsedConfig(parseToml(input));
  },
};
