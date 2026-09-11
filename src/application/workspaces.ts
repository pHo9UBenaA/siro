import path from 'node:path';
import { compileWorkspaceGlob } from './workspace-globs.ts';
import { compileAdditionalWorkspaceGlob } from './workspace-dialects.ts';
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

/** npm cancels an earlier exclusion when a later positive pattern matches it. */
const npmPatterns = (patterns: readonly string[]): readonly string[] => {
  const positive: string[] = [];
  let negative: { pattern: string; glob: ReturnType<typeof compileWorkspaceGlob> }[] = [];
  for (const raw of patterns) {
    const excluded = raw.startsWith('!');
    const pattern = (excluded ? raw.slice(1) : raw).replace(/^\.?\/+/u, '');
    if (excluded) {
      // npm compares declaration strings with default minimatch options,
      // independently of the platform policy used to enumerate directories.
      negative.push({ pattern, glob: compileWorkspaceGlob(pattern, {}) });
    } else {
      negative = negative.filter(({ glob }) => !glob.matches(pattern));
      positive.push(pattern);
    }
  }
  return [...positive, ...negative.map(({ pattern }) => `!${pattern}`)];
};

export interface WorkspaceDefinition {
  readonly patterns: readonly string[];
  readonly denoManifests: boolean;
}

/** Read declaration sources separately so Deno's two manifest sets stay distinct. */
export const workspaceDefinitions = (ctx: RepoContext, pm: PM): readonly WorkspaceDefinition[] => {
  const parse = createConfigParser(codecFor, ctx);
  const validate = (value: unknown, source: string, denoManifests = false): WorkspaceDefinition => {
    if (value === undefined) return { patterns: [], denoManifests };
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
      if (
        pm === 'deno' &&
        denoManifests &&
        !pattern.startsWith('!') &&
        path.posix.normalize(positive) === '.'
      ) {
        throw new ConfigError(`${source}: a Deno workspace cannot contain itself.`);
      }
    }
    return { patterns: pm === 'npm' ? npmPatterns(value) : value, denoManifests };
  };
  const packageDefinition = () => {
    let value = ctx.packageJson?.workspaces;
    if (isPlainRecord(value)) {
      value = value.packages;
      if (value === undefined)
        throw new ConfigError('package.json#workspaces: expected a packages array.');
    }
    return validate(value, 'package.json#workspaces');
  };
  if (pm === 'pnpm') {
    return [
      validate(
        ctx.exists(CONFIG_FILES.pnpmWorkspace.path)
          ? parse(CONFIG_FILES.pnpmWorkspace).packages
          : undefined,
        'pnpm-workspace.yaml#packages',
      ),
    ];
  }
  if (pm === 'aube') {
    const file = [CONFIG_FILES.aubeWorkspace, CONFIG_FILES.pnpmWorkspace].find((candidate) =>
      ctx.exists(candidate.path),
    );
    return [file ? validate(parse(file).packages, `${file.path}#packages`) : packageDefinition()];
  }
  if (pm === 'deno') {
    return [
      validate(parse(CONFIG_FILES.denoJson).workspace, 'deno.json#workspace', true),
      packageDefinition(),
    ];
  }
  return [packageDefinition()];
};

/** Traverse only ordinary directories that can fall under a positive pattern. */
export const workspaceDirectories = (
  ctx: RepoContext,
  fs: FileSystem,
  definition: WorkspaceDefinition,
  pm: PM,
): readonly RelPath[] => {
  const { patterns } = definition;
  const skipVendor =
    pm === 'deno' && createConfigParser(codecFor, ctx)(CONFIG_FILES.denoJson).vendor === true;
  const positive = patterns
    .filter((pattern) => !pattern.startsWith('!'))
    .map((pattern) => path.posix.normalize(pattern).replace(/\/+$/u, ''));
  const negative = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => path.posix.normalize(pattern.slice(1)).replace(/\/+$/u, ''));
  const compile = (pattern: string, excluded = false) =>
    pm === 'deno' || pm === 'aube'
      ? compileAdditionalWorkspaceGlob(pattern, pm, excluded)
      : compileWorkspaceGlob(pattern);
  const included = positive.map((pattern) => compile(pattern));
  const excluded = negative.map((pattern) => compile(pattern, true));
  const denoOrdered =
    pm === 'deno'
      ? patterns
          .filter((pattern) => /[*?]/u.test(pattern) || pattern.startsWith('!'))
          .map((pattern) => ({
            excluded: pattern.startsWith('!'),
            glob: compile(path.posix.normalize(pattern.replace(/^!/u, '')).replace(/\/+$/u, '')),
          }))
      : [];
  const denoLiteral =
    pm === 'deno'
      ? positive.filter((pattern) => !/[*?]/u.test(pattern)).map((pattern) => compile(pattern))
      : [];
  if (
    definition.denoManifests &&
    denoOrdered.findLast(({ glob }) => glob.matches('.'))?.excluded === false
  ) {
    throw new ConfigError('deno.json#workspace: a Deno workspace cannot contain itself.');
  }
  if (positive.length === 0 || positive.every((pattern) => pattern === '.')) return [];
  if (!fs.readDirectories)
    throw new UsageError(
      'Workspace discovery requires FileSystem.readDirectories; no host filesystem fallback is used.',
    );
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
      const inVendor = skipVendor && (directory === 'vendor' || directory.startsWith('vendor/'));
      if (
        inVendor &&
        !denoLiteral.some((pattern) => pattern.matches(directory) || pattern.canDescend(directory))
      )
        continue;
      const isExcluded = excluded.some(
        (pattern) => pattern.matches(directory) || pattern.matches(`${directory}/`),
      );
      if (isExcluded && pm !== 'aube' && pm !== 'deno') continue;
      const lastDenoMatch = denoOrdered.findLast(({ glob }) => glob.matches(directory));
      const selected =
        pm === 'deno'
          ? denoLiteral.some((pattern) => pattern.matches(directory)) ||
            (!inVendor && lastDenoMatch?.excluded === false)
          : !isExcluded && included.some((pattern) => pattern.matches(directory));
      if (selected) result.push(directory);
      // Fixed-depth declarations do not require opening member subdirectories.
      if ((inVendor ? denoLiteral : included).some((pattern) => pattern.canDescend(directory))) {
        pending.push(directory);
      }
    }
  }
  return result.sort();
};
