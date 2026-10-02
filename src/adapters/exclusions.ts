import { Minimatch } from 'minimatch';
import { ConfigError } from '../core/contracts/errors.ts';
import type { CompileExclusions } from '../core/contracts/exclusions.ts';

export const compileExclusions: CompileExclusions = (patterns) => {
  try {
    const matchers = patterns.map((pattern) => {
      // A trailing globstar also excludes its base directory before it is read.
      const directoryPattern = pattern.replace(/(?:\/\*\*)+$/u, '');
      // Brackets and backslashes are literal. Only *, ? and whole-component **
      // are operators; there is no second escape language.
      const escapedPattern = directoryPattern.replace(/[\\[\]]/gu, '\\$&');
      return new Minimatch(escapedPattern, {
        dot: true,
        nocase: false,
        nonegate: true,
        nocomment: true,
        nobrace: true,
        noext: true,
        platform: 'linux',
      });
    });
    return (directory) => matchers.some((matcher) => matcher.match(directory));
  } catch (error) {
    throw new ConfigError(`exclude: ${error instanceof Error ? error.message : String(error)}`);
  }
};
