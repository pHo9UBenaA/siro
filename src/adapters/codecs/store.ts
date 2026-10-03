import type { CodecFor, ConfigCodec } from '../../core/contracts/config-codec.ts';
import { type CodecKind, toParsedConfig } from '../../core/contracts/config-value.ts';
import { iniCodec } from './ini.ts';
import { jsonCodec, parseJson } from './json.ts';
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

const createBoundedCodec = (kind: CodecKind, limits: ScanLimits): ConfigCodec => {
  // JSON and YAML check depth inside their parsers; other codecs need the wrapper.
  if (kind === 'json') {
    return { parse: (text) => toParsedConfig(parseJson(text, limits.maxConfigDepth)) };
  }
  if (kind === 'yaml') {
    return { parse: (text) => parseYaml(text, limits.maxConfigDepth) };
  }
  return {
    parse(text) {
      const config = CODECS[kind].parse(text);
      checkConfigDepth(config, limits.maxConfigDepth);
      return config;
    },
  };
};

export const createCodecFor = (limits: ScanLimits): CodecFor => {
  // Reuse wrappers within this scan, never parsed contents or another scan's limits.
  const codecs: Partial<Record<CodecKind, ConfigCodec>> = {};
  return (kind) => (codecs[kind] ??= createBoundedCodec(kind, limits));
};
