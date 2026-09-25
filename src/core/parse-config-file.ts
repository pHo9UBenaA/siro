import type { CodecFor } from './contracts/config-codec.ts';
import type { ConfigFileRef } from './contracts/config-file-ref.ts';
import type { ParsedConfig } from './contracts/config-value.ts';
import type { RepoContext } from './contracts/repo-context.ts';
import { wrapCodecError } from './contracts/errors.ts';

/** A repository-context parser that memoizes successful `(kind, path)` reads. */
export type ConfigParser = (file?: ConfigFileRef) => ParsedConfig;

const EMPTY_FILE: ParsedConfig = Object.freeze({});

/** Create a lazy parser for one repository context; callers own its lifetime. */
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
