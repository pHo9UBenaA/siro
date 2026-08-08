import type { RepoContext } from '../ports/repo-context.ts';

export const isPublishable = (ctx: RepoContext): boolean => {
  const pkg = ctx.packageJson;
  if (typeof pkg === 'undefined') {
    return false;
  }
  return pkg.private !== true && typeof pkg.name === 'string' && pkg.name.length > 0;
};
