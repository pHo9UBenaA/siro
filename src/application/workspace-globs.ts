import { GLOBSTAR, Minimatch, type MinimatchOptions } from 'minimatch';
import { ConfigError } from '../shared/errors.ts';

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
    matcher = new Minimatch(pattern, options);
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
