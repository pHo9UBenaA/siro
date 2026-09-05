import type { CodecFor } from '../ports/config-codec.ts';
import type { ConfigFileRef } from '../entities/rule.ts';
import type { ParsedConfig } from '../entities/config-value.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { wrapCodecError } from '../../shared/errors.ts';

/** A command-scoped parser that memoizes each `(kind, path)` read. */
export type ConfigParser = (file?: ConfigFileRef) => ParsedConfig;

const EMPTY_FILE: ParsedConfig = Object.freeze({});

/** Create a fresh parser and cache for one lint command. */
export const createConfigParser = (codecFor: CodecFor, ctx: RepoContext): ConfigParser => {
  const cache = new Map<string, ParsedConfig>();

  return (file) => {
    if (file === undefined) {
      return EMPTY_FILE;
    }

    const cacheKey = `${file.kind}:${file.path}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const text = ctx.readText(file.path);
    if (text === undefined) {
      cache.set(cacheKey, EMPTY_FILE);
      return EMPTY_FILE;
    }
    const parsed = wrapCodecError(file.path, () => codecFor(file.kind).parse(text));
    cache.set(cacheKey, parsed);
    return parsed;
  };
};
