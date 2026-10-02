import type { CodecFor, ConfigCodec } from '../../core/contracts/config-codec.ts';
import type { CodecKind } from '../../core/contracts/config-value.ts';
import { iniCodec } from './ini.ts';
import { jsonCodec, parseJson } from './json.ts';
import { toParsedConfig } from '../../core/contracts/config-value.ts';
import { checkConfigDepth, type ScanLimits } from '../../core/contracts/scan-limits.ts';
import { tomlCodec } from './toml.ts';
import { yamlCodec, parseYaml } from './yaml.ts';

const CODECS = {
  json: jsonCodec,
  npmrc: iniCodec,
  toml: tomlCodec,
  yaml: yamlCodec,
} as const satisfies Record<CodecKind, ConfigCodec>;

/** Look up the codec for a parseable kind. Total — every CodecKind has one. */
export const codecFor: CodecFor = (kind) => CODECS[kind];

export const createCodecFor =
  (limits: ScanLimits): CodecFor =>
  (kind) => ({
    parse(text) {
      const parsed =
        kind === 'json'
          ? toParsedConfig(parseJson(text, limits.maxConfigDepth))
          : kind === 'yaml'
            ? parseYaml(text, limits.maxConfigDepth)
            : CODECS[kind].parse(text);
      checkConfigDepth(parsed, limits.maxConfigDepth);
      return parsed;
    },
  });
