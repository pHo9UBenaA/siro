import { braceExpand, GLOBSTAR, Minimatch, type MinimatchOptions } from 'minimatch';
import { ConfigError } from '../shared/errors.ts';

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
export const expandWorkspaceGlob = (pattern: string): readonly string[] => {
  try {
    return boundedBraceExpand(pattern);
  } catch (error) {
    if (error instanceof TypeError)
      throw new ConfigError(`Invalid workspace pattern: ${error.message}.`);
    throw error;
  }
};

/** Compile once so membership, exclusions, and traversal share glob semantics. */
export const compileWorkspaceGlob = (
  pattern: string,
  options: MinimatchOptions = {
    platform: 'linux',
    nocase: process.platform === 'darwin' || process.platform === 'win32',
    windowsPathsNoEscape: true,
    nonegate: true,
    nocomment: true,
    optimizationLevel: 2,
  },
) => {
  let matcher: Minimatch;
  try {
    if (!options.nobrace) boundedBraceExpand(pattern);
    matcher = new Minimatch(pattern, {
      ...options,
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
