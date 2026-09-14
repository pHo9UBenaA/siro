import type { compileWorkspaceGlob } from './workspace-globs.ts';

/** Anchor Deno's native literal prefix before applying its glob suffix. */
export const anchorWorkspacePrefix = (
  pattern: string,
  glob: ReturnType<typeof compileWorkspaceGlob>,
  resolveChild: (parent: string, name: string) => string | undefined,
): ReturnType<typeof compileWorkspaceGlob> => {
  const parts = pattern.split('/');
  const firstWildcard = parts.findIndex((part) => /[*?]/u.test(part));
  const prefix = parts.slice(0, firstWildcard < 0 ? parts.length : firstWildcard);
  if (prefix.length === 0 || pattern === '.') return glob;
  const declared = prefix.join('/');
  let resolved: string | undefined;
  let attempted = false;
  const resolve = () => {
    if (!attempted) {
      attempted = true;
      let current = '.';
      for (const part of prefix) {
        const child = resolveChild(current, part);
        if (child === undefined) return undefined;
        current = current === '.' ? child : `${current}/${child}`;
      }
      resolved = current;
    }
    return resolved;
  };
  const rewrite = (directory: string, actual: string) =>
    directory === actual
      ? declared
      : directory.startsWith(`${actual}/`)
        ? declared + directory.slice(actual.length)
        : undefined;
  return {
    matches(directory) {
      if (directory === '.') return false;
      const actual = resolve();
      const rewritten = actual === undefined ? undefined : rewrite(directory, actual);
      return rewritten !== undefined && glob.matches(rewritten);
    },
    canDescend(directory) {
      const actual = resolve();
      if (actual === undefined) return false;
      if (directory === '.' || actual.startsWith(`${directory}/`)) return true;
      const rewritten = rewrite(directory, actual);
      return rewritten !== undefined && glob.canDescend(rewritten);
    },
  };
};
