import type { WorkspaceGlobs } from './ports/workspace-glob.ts';
import { ConfigError } from '../shared/errors.ts';
import { hasBasicWorkspaceWildcard } from './workspace-pattern.ts';

const containsUnsupportedAubeGlobSyntax = (pattern: string): boolean => /[[\]{}()]/u.test(pattern);

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
  caseInsensitive: boolean,
  globs: WorkspaceGlobs,
) => {
  const parts = pattern.split('/');
  if (parts.some((part) => part.includes('**') && part !== '**')) {
    throw new ConfigError(`${pm}: ** must occupy an entire workspace path component.`);
  }
  if (
    pm === 'aube' &&
    (containsUnsupportedAubeGlobSyntax(pattern) ||
      (pattern.includes('**') &&
        (parts.at(-1) !== '**' || hasBasicWorkspaceWildcard(parts.slice(0, -1).join('/')))))
  ) {
    throw new ConfigError(
      'Aube workspace inspection supports literals, * and ?, and a trailing ** after a literal prefix; other glob forms are not yet supported.',
    );
  }
  // Punctuation outside the wildcard subset is literal. The adapter translates
  // that semantic contract into its engine's syntax.
  const matcher = globs.compile(pattern, {
    kind: 'directory',
    syntax: 'wildcards',
    includeDotDirectories: pm === 'aube',
    caseInsensitive: pm === 'deno' && (hasBasicWorkspaceWildcard(pattern) || caseInsensitive),
  });
  if (pm === 'deno' && hasBasicWorkspaceWildcard(pattern)) {
    const files = globs.compile(`${pattern}/package.json`, {
      kind: 'directory',
      syntax: 'wildcards',
      caseInsensitive: true,
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
