import { type ParsedConfig, toParsedConfig } from '../../domain/entities/config-value.ts';
import type { ConfigCodec } from '../../domain/ports/config-codec.ts';
import { parseDocument } from 'yaml';

export const yamlCodec: ConfigCodec = {
  parse(text: string): ParsedConfig {
    if (text.trim() === '') {
      return {};
    }
    // Keep the library's default maxAliasCount (the billion-laughs guard):
    // a fork-PR `pnpm-workspace.yaml` is attacker-controllable, so unbounded
    // alias expansion (`-1`) risks an OOM during CI lint (D14).
    const document = parseDocument(text);
    if (document.errors.length > 0) {
      throw document.errors[0];
    }
    return toParsedConfig(
      document.toJS({
        onAnchor: (value) => {
          JSON.stringify(value);
        },
      }),
    );
  },
};
