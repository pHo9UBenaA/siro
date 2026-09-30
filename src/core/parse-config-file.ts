import type { CodecFor } from './contracts/config-codec.ts';
import type { ConfigFileRef } from './contracts/config-file-ref.ts';
import type { ParsedConfig } from './contracts/config-value.ts';
import type { RepoContext } from './contracts/repo-context.ts';
import { wrapCodecError } from './contracts/errors.ts';
import { checkConfigDepth, DEFAULT_SCAN_LIMITS } from './contracts/scan-limits.ts';

/** A repository-context parser that memoizes successful `(kind, path)` reads. */
export type ConfigParser = (file?: ConfigFileRef) => ParsedConfig;

/** Keep a repository view and its evaluation-scoped parser together. */
export interface RepositoryEvaluation {
  readonly ctx: RepoContext;
  readonly parseConfig: ConfigParser;
}

const EMPTY_FILE: ParsedConfig = Object.freeze({});

/** Create a lazy parser for one repository context; callers own its lifetime. */
export const createConfigParser = (
  codecFor: CodecFor,
  ctx: RepoContext,
  maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth,
): ConfigParser => {
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
    checkConfigDepth(parsed, maxDepth);
    cache.set(cacheKey, parsed);
    return parsed;
  };
};

/** Pair the context with a fresh lazy parser; construction performs no reads. */
export const createRepositoryEvaluation = (
  ctx: RepoContext,
  codecFor: CodecFor,
  maxDepth = DEFAULT_SCAN_LIMITS.maxConfigDepth,
): RepositoryEvaluation => ({ ctx, parseConfig: createConfigParser(codecFor, ctx, maxDepth) });
