import { type ParsedConfig, getByPath } from './config-value.ts';
import { ConfigError } from './errors.ts';
import { isPlainRecord } from './records.ts';

/** Validate consumed publication metadata, not Deno's entire versioned schema. */
export const validateDenoMetadata = (config: ParsedConfig): void => {
  const name = getByPath(config, ['name']);
  if (name != null && typeof name !== 'string')
    throw new ConfigError('deno.json: name must be a string or null.');
  const publish = getByPath(config, ['publish']);
  if (publish == null || typeof publish === 'boolean') return;
  if (!isPlainRecord(publish))
    throw new ConfigError('deno.json: publish must be a boolean, object or null.');
  const include = getByPath(publish, ['include']);
  if (
    include != null &&
    (!Array.isArray(include) || !Array.from(include).every((item) => typeof item === 'string'))
  )
    throw new ConfigError('deno.json: publish.include must be a string array or null.');
};
