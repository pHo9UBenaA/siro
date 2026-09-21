/** Detect the basic * and ? markers shared across workspace dialects. */
export const hasBasicWorkspaceWildcard = (pattern: string): boolean =>
  pattern.includes('*') || pattern.includes('?');

/** Workspace declarations use POSIX separators regardless of the host platform. */
export const stripTrailingWorkspaceSlashes = (pattern: string): string => {
  let end = pattern.length;
  while (end > 0 && pattern[end - 1] === '/') end -= 1;
  return pattern.slice(0, end);
};
