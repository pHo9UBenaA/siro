import type { CodecFor } from '../ports/config-codec.ts';
import type { ConfigFileRef } from '../entities/rule.ts';
import type { ParsedConfig } from '../entities/config-value.ts';
import type { RepoContext } from '../ports/repo-context.ts';
import { wrapCodecError } from '../../shared/errors.ts';

/** Output of a `(kind, path)` parse. */
interface ParsedConfigFile {
  readonly parsed: ParsedConfig;
}

/**
 * A bound parser that memoises `(kind, path)` reads for the lifetime of the
 * factory's return value. One `runLint` evaluates O(rules × pms) bindings
 * targeting a small set of files (.npmrc, pnpm-workspace.yaml, package.json);
 * sharing one parser across the loop collapses the work to one parse per
 * `(kind, path)`. The cache is encapsulated here so it never leaks onto
 * `RepoContext`.
 */
export type ConfigParser = (ctx: RepoContext, file: ConfigFileRef) => ParsedConfigFile;

// `fileGlob` refs are existence probes, not parsed content. A single shared
// sentinel keeps the cache-miss path allocation-free for existence-only
// bindings. Frozen so a rule that did `(parsed as any)['x'] = 1` gets a
// TypeError instead of silently corrupting every future fileGlob caller.
const EMPTY_FILE: ParsedConfigFile = Object.freeze({
  parsed: Object.freeze({}),
});

const parseAndCache = (
  ctx: RepoContext,
  file: Exclude<ConfigFileRef, { kind: 'fileGlob' }>,
  deps: {
    readonly cache: Map<string, ParsedConfigFile>;
    readonly cacheKey: string;
    readonly codecFor: CodecFor;
  },
): ParsedConfigFile => {
  const text = ctx.readText(file.path) ?? '';
  const parsed = wrapCodecError(file.path, () => deps.codecFor(file.kind).parse(text));
  const entry: ParsedConfigFile = { parsed };
  deps.cache.set(deps.cacheKey, entry);
  return entry;
};

/** Create a fresh, command-scoped parser. Always call once per command. */
export const createConfigParser = (codecFor: CodecFor): ConfigParser => {
  const cache = new Map<string, ParsedConfigFile>();
  return (ctx, file) => {
    if (file.kind === 'fileGlob') {
      return EMPTY_FILE;
    }
    const cacheKey = `${file.kind}:${file.path}`;
    const hit = cache.get(cacheKey);
    if (typeof hit !== 'undefined') {
      return hit;
    }
    return parseAndCache(ctx, file, { cache, cacheKey, codecFor });
  };
};
