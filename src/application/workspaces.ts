import path from 'node:path';
import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import type { PM } from '../domain/entities/pms.ts';
import type { FileSystem } from '../domain/ports/file-system.ts';
import type { RepoContext } from '../domain/ports/repo-context.ts';
import { createConfigParser } from '../domain/services/parse-config-file.ts';
import { codecFor } from '../adapters/codecs/store.ts';
import { ConfigError, UsageError } from '../shared/errors.ts';
import { asRelPath, isRelPath, type RelPath } from '../shared/paths.ts';
import { resolveIn } from '../adapters/node-file-system.ts';
import { isPlainRecord } from '../shared/records.ts';

/** Read workspace declarations without executing any PM or child configuration. */
export const workspacePatterns = (ctx: RepoContext, pm: PM): readonly string[] => {
  if (pm === 'deno' || pm === 'aube') {
    throw new UsageError(
      `Workspace member inspection is not yet supported for ${pm}. Select npm, pnpm, yarn, or bun with --pm.`,
    );
  }
  let value: unknown = ctx.packageJson?.workspaces;
  let source = 'package.json#workspaces';
  if (pm === 'pnpm') {
    source = 'pnpm-workspace.yaml#packages';
    if (!ctx.exists(CONFIG_FILES.pnpmWorkspace.path)) return [];
    value = createConfigParser(codecFor, ctx)(CONFIG_FILES.pnpmWorkspace).packages;
    if (value === undefined) {
      throw new ConfigError(
        `${source}: workspace inspection requires an explicit packages array; implicit PM defaults are not inferred.`,
      );
    }
  } else if (isPlainRecord(value)) {
    value = value.packages;
    if (value === undefined) throw new ConfigError(`${source}: expected a packages array.`);
  }
  if (value === undefined) return [];
  if (!Array.isArray(value) || !Array.from(value).every((item) => typeof item === 'string')) {
    throw new ConfigError(`${source}: expected an array of directory patterns.`);
  }
  for (const pattern of value) {
    const positive = pattern.startsWith('!') ? pattern.slice(1) : pattern;
    if (!isRelPath(positive) || /[\\:]/u.test(positive) || positive.startsWith('!')) {
      throw new ConfigError(
        `${source}: use relative directory patterns without parent traversal: ${JSON.stringify(pattern)}.`,
      );
    }
  }
  return value;
};

/** Traverse only ordinary directories that can fall under a positive pattern. */
export const workspaceDirectories = (
  ctx: RepoContext,
  fs: FileSystem,
  patterns: readonly string[],
): readonly RelPath[] => {
  const positive = patterns
    .filter((pattern) => !pattern.startsWith('!'))
    .map((pattern) => path.posix.normalize(pattern).replace(/\/+$/u, ''));
  const negative = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => path.posix.normalize(pattern.slice(1)).replace(/\/+$/u, ''));
  if (positive.length === 0 || positive.every((pattern) => pattern === '.')) return [];
  if (!fs.readDirectories)
    throw new UsageError(
      'Workspace discovery requires FileSystem.readDirectories; no host filesystem fallback is used.',
    );
  const prefixes = positive.map((pattern) => {
    const wildcard = pattern.search(/[?*[{(]/u);
    if (wildcard < 0) return pattern;
    const literal = pattern.slice(0, wildcard);
    return literal.slice(0, Math.max(0, literal.lastIndexOf('/')));
  });
  const result: RelPath[] = [];
  const pending = ['.'];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    const names = fs.readDirectories(resolveIn(ctx.root, asRelPath(current)));
    if (!Array.isArray(names))
      throw new ConfigError('FileSystem.readDirectories must return an array of directory names.');
    for (const name of [...new Set(names)].sort()) {
      if (!isRelPath(name) || name === '.' || name === '..' || /[\\/]/u.test(name)) {
        throw new ConfigError(
          'FileSystem.readDirectories returned an invalid child directory name.',
        );
      }
      if (name === '.git' || name === 'node_modules') continue;
      const directory = asRelPath(current === '.' ? name : `${current}/${name}`);
      if (
        !prefixes.some(
          (prefix) =>
            prefix === '' ||
            directory === prefix ||
            directory.startsWith(`${prefix}/`) ||
            prefix.startsWith(`${directory}/`),
        )
      )
        continue;
      if (
        negative.some(
          (pattern) =>
            path.posix.matchesGlob(directory, pattern) ||
            path.posix.matchesGlob(`${directory}/`, pattern),
        )
      )
        continue;
      if (positive.some((pattern) => path.posix.matchesGlob(directory, pattern)))
        result.push(directory);
      // Fixed-depth declarations do not require opening member subdirectories.
      if (
        positive.some(
          (pattern) =>
            pattern.includes('**') || directory.split('/').length < pattern.split('/').length,
        )
      ) {
        pending.push(directory);
      }
    }
  }
  return result.sort();
};
