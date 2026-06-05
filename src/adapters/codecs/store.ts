import type { CodecFor, ConfigCodec } from '../../domain/ports/config-codec.ts';
import type { CodecKind } from '../../domain/entities/config-value.ts';
import { iniCodec } from './ini.ts';
import { jsonCodec } from './json.ts';
import { tomlCodec } from './toml.ts';
import { yamlCodec } from './yaml.ts';

const CODECS = {
  json: jsonCodec,
  npmrc: iniCodec,
  toml: tomlCodec,
  yaml: yamlCodec,
} as const satisfies Record<CodecKind, ConfigCodec>;

/** Look up the codec for a parseable kind. Total — every CodecKind has one. */
export const codecFor: CodecFor = (kind) => CODECS[kind];
