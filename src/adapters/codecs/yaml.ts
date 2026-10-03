import { type ParsedConfig, toParsedConfig } from '../../core/contracts/config-value.ts';
import type { ConfigCodec } from '../../core/contracts/config-codec.ts';
import { ConfigError, ConfigParseError } from '../../core/contracts/errors.ts';
import { checkConfigDepth, DEFAULT_SCAN_LIMITS } from '../../core/contracts/scan-limits.ts';
import { parseDocument } from 'yaml';

const decodeYaml = (text: string): unknown => {
  try {
    const document = parseDocument(text, { prettyErrors: false });
    if (document.errors.length) throw new ConfigParseError('Invalid YAML syntax.');
    if (document.contents === null) return {};
    // Keep toJS's default maxAliasCount: shared anchors are allowed, alias bombs are not.
    return document.toJS();
  } catch (error) {
    if (error instanceof ConfigParseError) throw error;
    if (error instanceof Error && error.message.includes('Excessive alias count'))
      throw new ConfigParseError('Excessive alias count in YAML.');
    throw new ConfigParseError('Invalid YAML.');
  }
};

export const parseYaml = (
  text: string,
  maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth,
): ParsedConfig => {
  if (text.trim() === '') return {};
  const value = decodeYaml(text);
  try {
    checkConfigDepth(value, maxDepth);
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigParseError('Invalid YAML structure.');
  }
  return toParsedConfig(value);
};
export const yamlCodec: ConfigCodec = { parse: (text) => parseYaml(text) };
