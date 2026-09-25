import type { WorkspaceGlobs, WorkspaceGlobOptions } from '../core/contracts/workspace-glob.ts';
import { braceExpand, GLOBSTAR, Minimatch, type MinimatchOptions } from 'minimatch';
import { ConfigError } from '../core/contracts/errors.ts';

const MAX_WORKSPACE_GLOB_ALTERNATIVES = 8_192;
const BRACE_EXPANSION_PROBE_LIMIT = MAX_WORKSPACE_GLOB_ALTERNATIVES + 1;

const boundedBraceExpand = (pattern: string): readonly string[] => {
  const alternatives = braceExpand(pattern, { braceExpandMax: BRACE_EXPANSION_PROBE_LIMIT });
  if (alternatives.length > MAX_WORKSPACE_GLOB_ALTERNATIVES) {
    throw new ConfigError(
      `Workspace pattern expands beyond ${MAX_WORKSPACE_GLOB_ALTERNATIVES} alternatives.`,
    );
  }
  return alternatives;
};

/** Expand with minimatch's own bounded brace semantics. */
const expandWorkspaceGlob = (pattern: string): readonly string[] => {
  try {
    return boundedBraceExpand(pattern);
  } catch (error) {
    if (error instanceof TypeError)
      throw new ConfigError(`Invalid workspace pattern: ${error.message}.`);
    throw error;
  }
};

/** Engine choices live here; the application supplies only PM matching policy. */
const engineOptions = (options: WorkspaceGlobOptions): MinimatchOptions => {
  if (options.kind === 'declaration') return {};
  return {
    platform: 'linux',
    windowsPathsNoEscape: true,
    nonegate: true,
    nocomment: !options.hashComments,
    nocase: options.caseInsensitive,
    dot: options.includeDotDirectories ?? false,
    nobrace: options.syntax === 'wildcards',
    noext: options.syntax === 'wildcards' || options.extendedPatterns === false,
    optimizationLevel: options.syntax === 'shell' ? 2 : 1,
  };
};

/** Compile once so membership, exclusions, and traversal share glob semantics. */
const compileWorkspaceGlob = (pattern: string, options: WorkspaceGlobOptions) => {
  let matcher: Minimatch;
  try {
    const settings = engineOptions(options);
    if (!settings.nobrace) boundedBraceExpand(pattern);
    const translated =
      options.kind === 'directory' && options.syntax === 'wildcards'
        ? pattern.replace(/[[\]]/gu, (character) => (character === '[' ? '[[]' : '[]]'))
        : pattern;
    matcher = new Minimatch(translated, {
      ...settings,
      braceExpandMax: BRACE_EXPANSION_PROBE_LIMIT,
    });
  } catch (error) {
    if (error instanceof TypeError)
      throw new ConfigError(`Invalid workspace pattern: ${error.message}.`);
    throw error;
  }
  return {
    matches: (directory: string): boolean => matcher.match(directory),
    canDescend(directory: string): boolean {
      const parts = directory.split('/');
      // Partial matches include completed paths. Only open a directory when
      // its matching alternative can consume another segment.
      return matcher.set.some(
        (alternative) =>
          (alternative.includes(GLOBSTAR) || parts.length < alternative.length) &&
          matcher.matchOne(parts, alternative, true),
      );
    },
  };
};

export const minimatchGlobs: WorkspaceGlobs = {
  expand: expandWorkspaceGlob,
  compile: compileWorkspaceGlob,
};
