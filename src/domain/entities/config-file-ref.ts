import { CODEC_KINDS, type CodecKind } from './config-value.ts';
import { isRelPath, type RelPath } from '../../shared/paths.ts';
import { isPlainRecord } from '../../shared/records.ts';

/** A repository-relative configuration location, independent of any rule. */
export interface ConfigFileRef {
  readonly kind: CodecKind;
  readonly path: RelPath;
}

const CONFIG_FILE_KINDS: ReadonlySet<string> = new Set(CODEC_KINDS);

export const isConfigFileRefShape = (value: unknown): value is ConfigFileRef => {
  if (!isPlainRecord(value) || typeof value.kind !== 'string' || !isRelPath(value.path)) {
    return false;
  }
  return CONFIG_FILE_KINDS.has(value.kind);
};
