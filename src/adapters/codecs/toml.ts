import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';
import { parse as parseToml } from 'smol-toml';
import { ConfigParseError } from '../../core/contracts/errors.ts';

export const tomlCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    if (text.trim() === '') {
      return {};
    }
    const input = text.startsWith('\uFEFF') ? text.slice(1) : text;
    let value: unknown;
    try {
      value = parseToml(input);
    } catch {
      throw new ConfigParseError('Invalid TOML syntax.');
    }
    return toParsedConfig(value);
  },
};
