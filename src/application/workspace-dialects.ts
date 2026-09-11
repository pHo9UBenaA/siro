import { compileWorkspaceGlob } from './workspace-globs.ts';
import { ConfigError } from '../shared/errors.ts';

const matchesCrossPathGlob = (pattern: string, value: string): boolean => {
  const patternCharacters = [...pattern];
  const valueCharacters = [...value];
  let patternIndex = 0;
  let valueIndex = 0;
  let starIndex = -1;
  let retryIndex = 0;
  while (valueIndex < valueCharacters.length) {
    const character = patternCharacters[patternIndex];
    if (character === '?' || character === valueCharacters[valueIndex]) {
      patternIndex += 1;
      valueIndex += 1;
    } else if (character === '*') {
      starIndex = patternIndex;
      retryIndex = valueIndex;
      patternIndex += 1;
    } else if (starIndex >= 0) {
      patternIndex = starIndex + 1;
      retryIndex += 1;
      valueIndex = retryIndex;
    } else {
      return false;
    }
  }
  while (patternCharacters[patternIndex] === '*') patternIndex += 1;
  return patternIndex === patternCharacters.length;
};

/** The bounded glob subset verified against the recorded Deno/Aube sources. */
export const compileAdditionalWorkspaceGlob = (
  pattern: string,
  pm: 'deno' | 'aube',
  excluded: boolean,
) => {
  const parts = pattern.split('/');
  if (parts.some((part) => part.includes('**') && part !== '**')) {
    throw new ConfigError(`${pm}: ** must occupy an entire workspace path component.`);
  }
  if (
    pm === 'aube' &&
    (/[[\]{}()]/u.test(pattern) ||
      (pattern.includes('**') &&
        (parts.at(-1) !== '**' || /[*?]/u.test(parts.slice(0, -1).join('/')))))
  ) {
    throw new ConfigError(
      'Aube workspace inspection supports literals, * and ?, and a trailing ** after a literal prefix; other glob forms are not yet supported.',
    );
  }
  // Deno treats brackets/braces/extglob punctuation literally. Aube's broader
  // Rust glob forms are rejected above rather than reinterpreted as minimatch.
  const escaped =
    pm === 'deno'
      ? pattern.replace(/[[\]]/gu, (character) => (character === '[' ? '[[]' : '[]]'))
      : pattern;
  const matcher = compileWorkspaceGlob(escaped, {
    platform: 'linux',
    windowsPathsNoEscape: true,
    nonegate: true,
    nocomment: true,
    nobrace: true,
    noext: true,
    dot: pm === 'aube',
    nocase:
      pm === 'deno' &&
      (/[*?]/u.test(pattern) || process.platform === 'darwin' || process.platform === 'win32'),
  });
  if (pm === 'deno' && /[*?]/u.test(pattern)) {
    const files = compileWorkspaceGlob(`${escaped}/package.json`, {
      platform: 'linux',
      windowsPathsNoEscape: true,
      nonegate: true,
      nocomment: true,
      nobrace: true,
      noext: true,
      nocase: true,
    });
    return {
      ...matcher,
      matches: (directory: string) =>
        files.matches(directory === '.' ? 'package.json' : `${directory}/package.json`),
    };
  }
  if (pm !== 'aube' || !excluded) return matcher;
  // Aube filters candidates (not traversal), and ordinary negative * crosses /.
  const self = pattern.endsWith('/**') ? pattern.slice(0, -3) : undefined;
  return {
    ...matcher,
    matches: (directory: string) => matchesCrossPathGlob(pattern, directory) || directory === self,
  };
};
