import path from 'node:path';
import { anchorWorkspacePrefix } from './workspace-prefix.ts';
import {
  compileWorkspaceGlob,
  defaultWorkspaceGlobOptions,
  expandWorkspaceGlob,
} from './workspace-globs.ts';
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
const splitNpmPattern = (raw: string) => {
  const prefix = /^!+/u.exec(raw)?.[0] ?? '';
  return { excluded: prefix.length % 2 === 1, pattern: raw.slice(prefix.length) };
};

const npmPatterns = (patterns: readonly string[]): readonly string[] => {
  const positive: string[] = [];
  let negative: { pattern: string; glob: ReturnType<typeof compileWorkspaceGlob> }[] = [];
  for (const raw of patterns) {
    const parsed = splitNpmPattern(raw);
    const pattern = parsed.pattern.replace(/^\.?\/+/u, '');
    if (parsed.excluded) {
      // npm compares declaration strings with default minimatch options,
      // independently of the platform policy used to enumerate directories.
      negative.push({ pattern, glob: compileWorkspaceGlob(pattern, {}) });
    } else {
      // Match @npmcli/map-workspaces' forward splice exactly. Adjacent duplicate
      // exclusions are not all removed because the shifted entry is skipped.
      for (let index = 0; index < negative.length; index += 1) {
        if (negative[index]?.glob.matches(pattern)) negative.splice(index, 1);
      }
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
      const positive =
        pm === 'npm'
          ? splitNpmPattern(pattern).pattern
          : pattern.startsWith('!')
            ? pattern.slice(1)
            : pattern;
      const alternatives =
        pm === 'deno' || pm === 'aube' ? [positive] : expandWorkspaceGlob(positive);
      if (
        alternatives.some(
          (alternative) =>
            !isRelPath(alternative) || alternative.includes('\\') || alternative.startsWith('!'),
        )
      ) {
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
  const directoryCache = new Map<string, readonly string[]>();
  const readDirectories = (directory: string): readonly string[] => {
    const cached = directoryCache.get(directory);
    if (cached) return cached;
    if (!fs.readDirectories)
      throw new UsageError(
        'Workspace discovery requires FileSystem.readDirectories; no host filesystem fallback is used.',
      );
    const names = fs.readDirectories(resolveIn(ctx.root, asRelPath(directory)));
    if (!Array.isArray(names))
      throw new ConfigError('FileSystem.readDirectories must return an array of directory names.');
    for (const name of Array.from(names)) {
      if (!isRelPath(name) || name === '.' || name === '..' || /[\\/]/u.test(name)) {
        throw new ConfigError(
          'FileSystem.readDirectories returned an invalid child directory name.',
        );
      }
    }
    const result = [...new Set(names)].sort();
    directoryCache.set(directory, result);
    return result;
  };
  const resolveChild = (parent: string, name: string): string | undefined => {
    if (name === '.git' || name === 'node_modules') return undefined;
    const names = readDirectories(parent);
    const resolved = names.includes(name)
      ? name
      : fs.resolveDirectory?.(resolveIn(ctx.root, asRelPath(parent)), name);
    if (resolved !== undefined && !names.includes(resolved)) {
      throw new ConfigError(
        'FileSystem.resolveDirectory must return an enumerated ordinary child directory name.',
      );
    }
    return resolved === '.git' || resolved === 'node_modules' ? undefined : resolved;
  };
  const compile = (pattern: string, excluded = false) => {
    if (pm !== 'deno' && pm !== 'aube')
      return compileWorkspaceGlob(
        pattern,
        pm === 'npm'
          ? { ...defaultWorkspaceGlobOptions, nocomment: false }
          : defaultWorkspaceGlobOptions,
      );
    const glob = compileAdditionalWorkspaceGlob(pattern, pm, excluded);
    return pm === 'deno' && !excluded ? anchorWorkspacePrefix(pattern, glob, resolveChild) : glob;
  };
  const included = positive.map((pattern) => compile(pattern));
  const excluded = negative.map((pattern) => {
    const glob = compile(pattern, true);
    const subtree =
      pm === 'deno' || pm === 'aube' || pm === 'bun'
        ? undefined
        : pattern === '**'
          ? { matches: () => true }
          : pattern.endsWith('/**')
            ? compile(pattern.slice(0, -3), true)
            : undefined;
    return { glob, subtree };
  });
  const declaredBase = (pattern: string) => {
    const parts = pattern.split('/');
    const wildcard = parts.findIndex((part) => /[*?]/u.test(part));
    return parts.slice(0, wildcard < 0 ? parts.length : wildcard).join('/') || '.';
  };
  const relatedBases = (left: string, right: string) =>
    left === '.' ||
    right === '.' ||
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`);
  const denoPositive =
    pm === 'deno'
      ? positive
          .filter((pattern) => /[*?]/u.test(pattern))
          .map((pattern) => ({
            base: declaredBase(pattern),
            scope: anchorWorkspacePrefix(
              declaredBase(pattern),
              {
                matches: () => true,
                canDescend: () => true,
              },
              resolveChild,
            ),
          }))
      : [];
  const denoOrdered =
    pm === 'deno'
      ? patterns
          .filter((pattern) => /[*?]/u.test(pattern) || pattern.startsWith('!'))
          .map((raw) => {
            const isExcluded = raw.startsWith('!');
            const pattern = path.posix.normalize(raw.replace(/^!/u, '')).replace(/\/+$/u, '');
            const glob = compile(pattern, isExcluded);
            if (!isExcluded) return { excluded: false, glob };
            return {
              excluded: true,
              glob: {
                ...glob,
                matches(directory: string) {
                  // Negative paths are lexical, not filesystem lookups. Negative globs
                  // only apply to related declared positive bases, then match without case.
                  if (!/[*?]/u.test(pattern)) return directory === pattern;
                  if (!glob.matches(directory)) return false;
                  const applicable = denoPositive
                    .filter((item) => item.scope.matches(directory))
                    .map((item) => relatedBases(item.base, declaredBase(pattern)));
                  if (applicable.some(Boolean) && applicable.some((value) => !value)) {
                    throw new ConfigError(
                      'Deno workspace exclusion has ambiguous overlapping bases; use consistent prefix spelling or separate non-overlapping patterns.',
                    );
                  }
                  return applicable.some(Boolean);
                },
              },
            };
          })
      : [];
  const bunPatterns =
    pm === 'bun'
      ? patterns.map((raw) => {
          const isExcluded = raw.startsWith('!');
          const pattern = path.posix.normalize(raw.replace(/^!/u, '')).replace(/\/+$/u, '');
          // Bun inserts literal members directly. Only its syntax markers enter
          // the ordered glob pass, where later negatives filter each positive.
          const usesGlob =
            isExcluded ||
            pattern.includes('*') ||
            pattern.includes('?') ||
            pattern.includes('{') ||
            pattern.includes('[');
          const glob = compileWorkspaceGlob(pattern, {
            ...defaultWorkspaceGlobOptions,
            noext: true,
          });
          const subtree =
            isExcluded && pattern.endsWith('/**')
              ? compileWorkspaceGlob(pattern.slice(0, -3), {
                  ...defaultWorkspaceGlobOptions,
                  noext: true,
                })
              : undefined;
          return {
            isExcluded,
            usesGlob,
            glob,
            matches: (directory: string) =>
              glob.matches(directory) ||
              glob.matches(`${directory}/`) ||
              subtree?.matches(directory) === true,
          };
        })
      : [];
  const bunOrdered = bunPatterns.filter(({ usesGlob }) => usesGlob);
  const bunLiterals = bunPatterns.filter(({ isExcluded, usesGlob }) => !isExcluded && !usesGlob);
  const bunTraversal = bunPatterns.filter(({ isExcluded }) => !isExcluded).map(({ glob }) => glob);
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
    for (const name of readDirectories(current)) {
      if (name === '.git' || name === 'node_modules') continue;
      const directory = asRelPath(current === '.' ? name : `${current}/${name}`);
      if (
        pm === 'bun' &&
        name === 'CMakeFiles' &&
        !bunLiterals.some(({ glob }) => glob.matches(directory) || glob.canDescend(directory))
      )
        continue;
      const inVendor = skipVendor && (directory === 'vendor' || directory.startsWith('vendor/'));
      if (
        inVendor &&
        !denoLiteral.some((pattern) => pattern.matches(directory) || pattern.canDescend(directory))
      )
        continue;
      const isExcluded =
        pm !== 'deno' &&
        excluded.some(({ glob }) => glob.matches(directory) || glob.matches(`${directory}/`));
      if (excluded.some(({ subtree }) => subtree?.matches(directory))) continue;
      const lastDenoMatch = denoOrdered.findLast(({ glob }) => glob.matches(directory));
      const lastBunMatch = bunOrdered.findLast(({ matches }) => matches(directory));
      const selected =
        pm === 'deno'
          ? denoLiteral.some((pattern) => pattern.matches(directory)) ||
            (!inVendor && lastDenoMatch?.excluded === false)
          : pm === 'bun'
            ? bunLiterals.some(({ glob }) => glob.matches(directory)) ||
              lastBunMatch?.isExcluded === false
            : !isExcluded && included.some((pattern) => pattern.matches(directory));
      if (selected) result.push(directory);
      // Fixed-depth declarations do not require opening member subdirectories.
      const traversalPatterns = pm === 'bun' ? bunTraversal : inVendor ? denoLiteral : included;
      if (traversalPatterns.some((pattern) => pattern.canDescend(directory))) {
        pending.push(directory);
      }
    }
  }
  return result.sort();
};
