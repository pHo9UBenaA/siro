import { Minimatch } from 'minimatch';
import { ConfigError } from '../core/contracts/errors.ts';
import type { CompileExclusions } from '../core/contracts/exclusions.ts';

export const compileExclusions: CompileExclusions = (patterns) => {
  try {
    const matchers = patterns.map(
      (pattern) =>
        new Minimatch(
          // A trailing globstar also excludes its base directory before it is read.
          pattern.replace(/(?:\/\*\*)+$/u, '').replace(/[\\[\]]/gu, '\\$&'),
          {
            dot: true,
            nocase: false,
            nonegate: true,
            nocomment: true,
            nobrace: true,
            noext: true,
            // Escape brackets and the escape character itself. Only *, ?
            // and whole-component ** are operators; no second escape language.
            platform: 'linux',
          },
        ),
    );
    return (directory) => matchers.some((matcher) => matcher.match(directory));
  } catch (error) {
    throw new ConfigError(`exclude: ${error instanceof Error ? error.message : String(error)}`);
  }
};
