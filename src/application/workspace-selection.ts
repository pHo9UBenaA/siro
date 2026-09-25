import type { LintDependencies } from '../core/contracts/lint-dependencies.ts';
import type { WorkspaceGlob } from '../core/contracts/workspace-glob.ts';
import type { WorkspaceDefinition } from './workspace-definitions.ts';
import { anchorWorkspacePrefix } from './workspace-prefix.ts';
import { workspaceGlobOptions } from './workspace-glob-policy.ts';
import { compileAdditionalWorkspaceGlob } from './workspace-dialects.ts';
import { hasBasicWorkspaceWildcard, stripTrailingWorkspaceSlashes } from './workspace-pattern.ts';
import { CONFIG_FILES } from '../domain/entities/config-files.ts';
import type { PM } from '../core/contracts/pms.ts';
import type { ConfigParser } from '../domain/services/parse-config-file.ts';
import { ConfigError } from '../core/contracts/errors.ts';

interface WorkspaceSelection {
  /** Prune this directory and its descendants without reading its manifest. */
  skipDirectory: (directory: string, name: string) => boolean;
  includes: (directory: string) => boolean;
  canDescend: (directory: string) => boolean;
  /** Native Deno literals must be checked against resolved directory names. */
  isExplicitMember: (directory: string) => boolean;
}

type ResolveChild = (parent: string, name: string) => string | undefined;
type Compile = (pattern: string, excluded?: boolean) => WorkspaceGlob;

const declaredBase = (pattern: string): string => {
  const parts = pattern.split('/');
  const wildcard = parts.findIndex(hasBasicWorkspaceWildcard);
  return parts.slice(0, wildcard < 0 ? parts.length : wildcard).join('/') || '.';
};

const relatedBases = (left: string, right: string): boolean =>
  left === '.' ||
  right === '.' ||
  left === right ||
  left.startsWith(`${right}/`) ||
  right.startsWith(`${left}/`);

const denoSelection = (
  patterns: readonly string[],
  positive: readonly string[],
  included: readonly WorkspaceGlob[],
  definition: WorkspaceDefinition,
  dependencies: Pick<LintDependencies, 'paths'>,
  compile: Compile,
  resolveChild: ResolveChild,
  skipVendor: boolean,
): WorkspaceSelection => {
  const denoPositive = positive.filter(hasBasicWorkspaceWildcard).map((pattern) => ({
    base: declaredBase(pattern),
    scope: anchorWorkspacePrefix(
      declaredBase(pattern),
      { matches: () => true, canDescend: () => true },
      resolveChild,
    ),
  }));
  const ordered = patterns
    .filter((pattern) => hasBasicWorkspaceWildcard(pattern) || pattern.startsWith('!'))
    .map((raw) => {
      const excluded = raw.startsWith('!');
      const pattern = stripTrailingWorkspaceSlashes(
        dependencies.paths.normalizePattern(excluded ? raw.slice(1) : raw),
      );
      const glob = compile(pattern, excluded);
      if (!excluded) return { excluded: false, glob };
      return {
        excluded: true,
        glob: {
          ...glob,
          matches(directory: string) {
            // Negative paths are lexical, not filesystem lookups. Negative globs
            // only apply to related declared positive bases, then match without case.
            if (!hasBasicWorkspaceWildcard(pattern)) return directory === pattern;
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
    });
  const literal = positive
    .filter((pattern) => !hasBasicWorkspaceWildcard(pattern))
    .map((pattern) => compile(pattern));
  if (
    definition.fromDenoJson &&
    ordered.findLast(({ glob }) => glob.matches('.'))?.excluded === false
  ) {
    throw new ConfigError('deno.json#workspace: a Deno workspace cannot contain itself.');
  }
  const inVendor = (directory: string) =>
    skipVendor && (directory === 'vendor' || directory.startsWith('vendor/'));
  return {
    skipDirectory: (directory) =>
      inVendor(directory) &&
      !literal.some((pattern) => pattern.matches(directory) || pattern.canDescend(directory)),
    includes(directory) {
      const lastMatch = ordered.findLast(({ glob }) => glob.matches(directory));
      return (
        literal.some((pattern) => pattern.matches(directory)) ||
        (!inVendor(directory) && lastMatch?.excluded === false)
      );
    },
    canDescend: (directory) =>
      (inVendor(directory) ? literal : included).some((pattern) => pattern.canDescend(directory)),
    isExplicitMember: (directory) => literal.some((pattern) => pattern.matches(directory)),
  };
};

const bunSelection = (
  patterns: readonly string[],
  dependencies: Pick<LintDependencies, 'globs' | 'paths' | 'caseInsensitiveGlobs'>,
): WorkspaceSelection => {
  const { globs, paths, caseInsensitiveGlobs } = dependencies;
  const options = { ...workspaceGlobOptions(caseInsensitiveGlobs), extendedPatterns: false };
  const compiled = patterns.map((raw) => {
    const isExcluded = raw.startsWith('!');
    const pattern = stripTrailingWorkspaceSlashes(
      paths.normalizePattern(isExcluded ? raw.slice(1) : raw),
    );
    // Bun inserts literal members directly. Only syntax markers enter the
    // ordered glob pass, where later negatives filter each positive.
    const usesGlob =
      isExcluded ||
      hasBasicWorkspaceWildcard(pattern) ||
      pattern.includes('{') ||
      pattern.includes('[');
    const glob = globs.compile(pattern, options);
    const subtree =
      isExcluded && pattern.endsWith('/**')
        ? globs.compile(pattern.slice(0, -3), options)
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
  });
  const ordered = compiled.filter(({ usesGlob }) => usesGlob);
  const literals = compiled.filter(({ isExcluded, usesGlob }) => !isExcluded && !usesGlob);
  const traversal = compiled.filter(({ isExcluded }) => !isExcluded).map(({ glob }) => glob);
  return {
    skipDirectory: (directory, name) =>
      name === 'CMakeFiles' &&
      !literals.some(({ glob }) => glob.matches(directory) || glob.canDescend(directory)),
    includes(directory) {
      const lastMatch = ordered.findLast(({ matches }) => matches(directory));
      return (
        literals.some(({ glob }) => glob.matches(directory)) || lastMatch?.isExcluded === false
      );
    },
    canDescend: (directory) => traversal.some((pattern) => pattern.canDescend(directory)),
    isExplicitMember: () => false,
  };
};

/** Compile PM syntax and ordering once; traversal only calls the resulting policy. */
export const createWorkspaceSelection = (
  definition: WorkspaceDefinition,
  pm: PM,
  dependencies: Pick<LintDependencies, 'globs' | 'paths' | 'caseInsensitiveGlobs'>,
  parseConfig: ConfigParser,
  resolveChild: ResolveChild,
): WorkspaceSelection | undefined => {
  const { paths, globs, caseInsensitiveGlobs } = dependencies;
  const { patterns } = definition;
  const skipVendor = pm === 'deno' && parseConfig(CONFIG_FILES.denoJson).vendor === true;
  const positive = patterns
    .filter((pattern) => !pattern.startsWith('!'))
    .map((pattern) => stripTrailingWorkspaceSlashes(paths.normalizePattern(pattern)));
  const negative = patterns
    .filter((pattern) => pattern.startsWith('!'))
    .map((pattern) => stripTrailingWorkspaceSlashes(paths.normalizePattern(pattern.slice(1))));
  const hasMembers = positive.some((pattern) => pattern !== '.');
  // Bun has its own ordered glob pass. Compiling the standard matcher first
  // creates a second, unused view of each declaration with different options.
  if (pm === 'bun') {
    const selection = bunSelection(patterns, dependencies);
    return hasMembers ? selection : undefined;
  }

  const options = workspaceGlobOptions(caseInsensitiveGlobs);
  const compile: Compile = (pattern, excluded = false) => {
    if (pm !== 'deno' && pm !== 'aube')
      return globs.compile(pattern, pm === 'npm' ? { ...options, hashComments: true } : options);
    const glob = compileAdditionalWorkspaceGlob(pattern, pm, excluded, caseInsensitiveGlobs, globs);
    return pm === 'deno' && !excluded ? anchorWorkspacePrefix(pattern, glob, resolveChild) : glob;
  };
  const included = positive.map((pattern) => compile(pattern));
  const excluded = negative.map((pattern) => {
    const glob = compile(pattern, true);
    const subtree =
      pm === 'deno' || pm === 'aube'
        ? undefined
        : pattern === '**'
          ? { matches: () => true }
          : pattern.endsWith('/**')
            ? compile(pattern.slice(0, -3), true)
            : undefined;
    return { glob, subtree };
  });
  if (pm === 'deno') {
    const selection = denoSelection(
      patterns,
      positive,
      included,
      definition,
      dependencies,
      compile,
      resolveChild,
      skipVendor,
    );
    return hasMembers ? selection : undefined;
  }
  const selection: WorkspaceSelection = {
    skipDirectory: (directory) => excluded.some(({ subtree }) => subtree?.matches(directory)),
    includes: (directory) =>
      !excluded.some(({ glob }) => glob.matches(directory) || glob.matches(`${directory}/`)) &&
      included.some((pattern) => pattern.matches(directory)),
    canDescend: (directory) => included.some((pattern) => pattern.canDescend(directory)),
    isExplicitMember: () => false,
  };
  return hasMembers ? selection : undefined;
};
