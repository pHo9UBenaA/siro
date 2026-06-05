import type { CodecKind, ParsedConfig } from '../entities/config-value.ts';

/** Reads a single config-file format into siro's structural view. */
export interface ConfigCodec {
  parse: (text: string) => ParsedConfig;
}

/** Resolve the codec for a given file kind. Total over `CodecKind`. */
export type CodecFor = (kind: CodecKind) => ConfigCodec;
